import { db } from '../db/database';
import { localKeyFromRemoteId, tableFor, type Collection } from './collections';
import { clearApplying, enqueueEverything, markApplying } from './outbox';
import type { PendingChange, RemoteAdapter, RemoteRecord } from './remote';

const CURSOR_KEY = 'sync.cursor';
const MIGRATED_KEY = 'sync.initialUploadDone';

/** Re-request a small window before the cursor so rows written in the same
 * instant as the last one seen can't slip through the gap. Re-applying a row
 * we already have is harmless. */
const CURSOR_OVERLAP_MS = 2000;

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
}

type StatusListener = (status: SyncStatus) => void;

async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.syncMeta.get(key);
  return row?.value as T | undefined;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await db.syncMeta.put({ key, value });
}

export class SyncEngine {
  private adapter: RemoteAdapter;
  private listeners = new Set<StatusListener>();
  private status: SyncStatus = { state: 'idle', lastSyncedAt: null, pendingCount: 0, error: null };
  private running = false;
  private syncQueued = false;
  private syncing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeRemote: (() => void) | null = null;

  constructor(adapter: RemoteAdapter) {
    this.adapter = adapter;
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l(this.status);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.unsubscribeRemote = this.adapter.subscribe(() => void this.syncNow());

    // A safety net behind realtime: catches anything missed while backgrounded,
    // asleep, or on a flaky pub wifi.
    this.timer = setInterval(() => void this.syncNow(), 30_000);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('focus', this.handleFocus);
    document.addEventListener('visibilitychange', this.handleVisibility);

    await this.syncNow();
  }

  stop(): void {
    this.running = false;
    this.unsubscribeRemote?.();
    this.unsubscribeRemote = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private handleOnline = () => void this.syncNow();
  private handleFocus = () => void this.syncNow();
  private handleVisibility = () => {
    if (document.visibilityState === 'visible') void this.syncNow();
  };

  /** Runs a full push+pull. Concurrent calls collapse into one trailing run. */
  async syncNow(): Promise<void> {
    if (!this.running) return;
    if (this.syncing) {
      this.syncQueued = true;
      return;
    }
    this.syncing = true;
    this.emit({ state: 'syncing', error: null });

    try {
      if (!navigator.onLine) {
        this.emit({ state: 'offline', pendingCount: await db.outbox.count() });
        return;
      }

      await this.ensureInitialUpload();
      await this.push();
      await this.pull();

      const now = new Date().toISOString();
      await setMeta('sync.lastSyncedAt', now);
      this.emit({ state: 'idle', lastSyncedAt: now, error: null, pendingCount: await db.outbox.count() });
    } catch (err) {
      this.emit({
        state: navigator.onLine ? 'error' : 'offline',
        error: err instanceof Error ? err.message : String(err),
        pendingCount: await db.outbox.count().catch(() => 0),
      });
    } finally {
      this.syncing = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        void this.syncNow();
      }
    }
  }

  /**
   * The first time this device ever syncs, everything already sitting in its
   * local database is queued for upload. This is what carries the existing
   * reviews, ratings, visits and photos into the shared database — nothing is
   * cleared, it's purely additive in both directions.
   */
  private async ensureInitialUpload(): Promise<void> {
    if (await getMeta<boolean>(MIGRATED_KEY)) return;
    await enqueueEverything();
    await setMeta(MIGRATED_KEY, true);
  }

  private async push(): Promise<void> {
    const entries = await db.outbox.orderBy('queuedAt').toArray();
    if (entries.length === 0) return;

    const BATCH = 25;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const changes: PendingChange[] = [];

      for (const entry of batch) {
        const collection = entry.collection as Collection;

        if (entry.deleted) {
          changes.push({ collection, id: entry.recordId, data: null, deleted: true });
          if (collection === 'photos') {
            await this.adapter.deletePhoto(entry.recordId).catch(() => {});
          }
          continue;
        }

        const key = localKeyFromRemoteId(collection, entry.recordId);
        const row = await tableFor(collection).get(key);
        if (!row) {
          // Row vanished between queueing and sending — treat as a delete so the
          // other phone doesn't keep a copy we no longer have.
          changes.push({ collection, id: entry.recordId, data: null, deleted: true });
          continue;
        }

        if (collection === 'photos') {
          const photo = row as { id: string; blob: Blob; thumbBlob: Blob; drinkId: string; createdAt: string };
          await this.adapter.uploadPhoto(photo.id, { blob: photo.blob, thumbBlob: photo.thumbBlob });
          changes.push({
            collection,
            id: entry.recordId,
            data: { id: photo.id, drinkId: photo.drinkId, createdAt: photo.createdAt },
            deleted: false,
          });
        } else {
          changes.push({ collection, id: entry.recordId, data: row as Record<string, unknown>, deleted: false });
        }
      }

      await this.adapter.push(changes);
      await db.outbox.bulkDelete(batch.map((e) => e.key));
    }
  }

  private async pull(): Promise<void> {
    const cursor = await getMeta<string>(CURSOR_KEY);
    const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;

    const records = await this.adapter.pull(since);
    if (records.length === 0) return;

    let newest = cursor ?? '';
    for (const record of records) {
      if (record.updatedAt > newest) newest = record.updatedAt;
      await this.applyRemoteRecord(record);
    }

    if (newest) await setMeta(CURSOR_KEY, newest);
  }

  private async applyRemoteRecord(record: RemoteRecord): Promise<void> {
    const collection = record.collection;
    if (!collection) return;

    // A row with unpushed local edits wins until those edits have gone up;
    // otherwise a pull could clobber a change made seconds ago on this phone.
    const pending = await db.outbox.get(`${collection}:${record.id}`);
    if (pending) return;

    const table = tableFor(collection);
    const key = localKeyFromRemoteId(collection, record.id);

    markApplying(collection, record.id);
    try {
      if (record.deleted || !record.data) {
        await table.delete(key);
        return;
      }

      if (collection === 'photos') {
        const existing = (await table.get(key)) as { blob?: Blob } | undefined;
        if (existing?.blob) {
          // Metadata refresh only — never re-download bytes we already hold.
          await table.put({ ...existing, ...record.data });
          return;
        }
        const payload = await this.adapter.downloadPhoto(String(record.data.id));
        if (!payload) return; // bytes not there (yet) — retried on the next pass
        await table.put({ ...record.data, blob: payload.blob, thumbBlob: payload.thumbBlob });
        return;
      }

      await table.put(record.data);
    } finally {
      clearApplying(collection, record.id);
    }
  }
}
