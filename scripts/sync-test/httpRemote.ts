import type { Collection } from '../../src/sync/collections';
import type { PendingChange, PhotoPayload, RemoteAdapter, RemoteRecord } from '../../src/sync/remote';

/** Talks to scripts/sync-test/mock-backend.mjs using the same shape the real
 * Supabase adapter uses, so the sync engine under test is the production one. */
export class HttpRemote implements RemoteAdapter {
  private base: string;

  constructor(base: string) {
    this.base = base;
  }

  async pull(since: string | null): Promise<RemoteRecord[]> {
    const res = await fetch(`${this.base}/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ since }),
    });
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    const { rows } = (await res.json()) as {
      rows: { collection: string; id: string; data: Record<string, unknown> | null; deleted: boolean; updated_at: string }[];
    };
    return rows.map((r) => ({
      collection: r.collection as Collection,
      id: r.id,
      data: r.data,
      deleted: r.deleted,
      updatedAt: r.updated_at,
    }));
  }

  async push(changes: PendingChange[]): Promise<void> {
    const res = await fetch(`${this.base}/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ changes }),
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
  }

  async uploadPhoto(photoId: string, payload: PhotoPayload): Promise<void> {
    await Promise.all([
      fetch(`${this.base}/photo/${photoId}/full`, { method: 'PUT', body: await payload.blob.arrayBuffer() }),
      fetch(`${this.base}/photo/${photoId}/thumb`, { method: 'PUT', body: await payload.thumbBlob.arrayBuffer() }),
    ]);
  }

  async downloadPhoto(photoId: string): Promise<PhotoPayload | null> {
    const [full, thumb] = await Promise.all([
      fetch(`${this.base}/photo/${photoId}/full`),
      fetch(`${this.base}/photo/${photoId}/thumb`),
    ]);
    if (!full.ok) return null;
    return {
      blob: new Blob([await full.arrayBuffer()]),
      thumbBlob: new Blob([thumb.ok ? await thumb.arrayBuffer() : new ArrayBuffer(0)]),
    };
  }

  async deletePhoto(photoId: string): Promise<void> {
    await fetch(`${this.base}/photo/${photoId}/full`, { method: 'DELETE' });
  }

  subscribe(): () => void {
    // The test drives syncNow() explicitly; realtime push is Supabase's job.
    return () => {};
  }
}
