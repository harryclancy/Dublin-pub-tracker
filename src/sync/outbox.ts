import { db } from '../db/database';
import { SYNCED_COLLECTIONS, tableFor, type Collection } from './collections';

/**
 * Rows currently being written by the sync engine itself (remote → local).
 * Writes for these keys must not be re-queued as outbound changes, or every
 * pull would bounce straight back as a push.
 */
const applyingKeys = new Set<string>();

export function outboxKey(collection: Collection, recordId: string): string {
  return `${collection}:${recordId}`;
}

export function markApplying(collection: Collection, recordId: string): void {
  applyingKeys.add(outboxKey(collection, recordId));
}

export function clearApplying(collection: Collection, recordId: string): void {
  applyingKeys.delete(outboxKey(collection, recordId));
}

function remoteIdFromPrimaryKey(primKey: unknown): string {
  return Array.isArray(primKey) ? primKey.join('::') : String(primKey);
}

async function enqueue(collection: Collection, recordId: string, deleted: boolean): Promise<void> {
  const key = outboxKey(collection, recordId);
  try {
    await db.outbox.put({ key, collection, recordId, deleted, queuedAt: new Date().toISOString() });
  } catch {
    // Queueing is best-effort; a missed entry is picked up by the periodic
    // full reconcile rather than silently lost.
  }
}

let installed = false;

/**
 * Watches every synced table and records which rows changed, without touching
 * any of the existing call sites in db/actions.ts.
 *
 * Dexie fires hooks inside the write's own transaction, which won't include
 * the outbox table, so the queue write is deferred until after that
 * transaction settles. A queued entry for a write that ends up rolled back is
 * harmless: the pusher reads the row's live state at send time, so it either
 * pushes what's actually there or skips a row that no longer exists.
 *
 * The "is this write coming from the sync engine?" check has to happen here,
 * synchronously inside the hook — by the time a deferred callback runs the
 * engine has already finished applying and cleared the marker, so a deferred
 * check would wave every pulled row straight back into the push queue. That
 * turns each pull into a push of this device's copy, which both ping-pongs
 * endlessly between the two phones and can overwrite the other person's newer
 * edit with an older one.
 */
export function installOutboxHooks(): void {
  if (installed) return;
  installed = true;

  for (const collection of SYNCED_COLLECTIONS) {
    const table = tableFor(collection);

    const queue = (id: string, deleted: boolean) => {
      if (applyingKeys.has(outboxKey(collection, id))) return;
      setTimeout(() => void enqueue(collection, id, deleted), 0);
    };

    table.hook('creating', (primKey: unknown, obj: Record<string, unknown>) => {
      // For auto-derived keys `primKey` can be undefined here; fall back to the object.
      const id = primKey === undefined ? remoteIdFromPrimaryKey(obj.id ?? obj.pubId) : remoteIdFromPrimaryKey(primKey);
      queue(id, false);
    });

    table.hook('updating', (_mods: unknown, primKey: unknown) => {
      queue(remoteIdFromPrimaryKey(primKey), false);
    });

    table.hook('deleting', (primKey: unknown) => {
      queue(remoteIdFromPrimaryKey(primKey), true);
    });
  }
}

/** Queues every local row for upload — used for the one-off first migration. */
export async function enqueueEverything(): Promise<number> {
  let count = 0;
  for (const collection of SYNCED_COLLECTIONS) {
    const rows = await tableFor(collection).toArray();
    for (const row of rows) {
      const id =
        collection === 'reviews'
          ? `${row.pubId}::${row.person}`
          : String(row.id ?? row.pubId);
      await db.outbox.put({
        key: outboxKey(collection, id),
        collection,
        recordId: id,
        deleted: false,
        queuedAt: new Date().toISOString(),
      });
      count++;
    }
  }
  return count;
}
