import type { SupabaseClient } from '@supabase/supabase-js';
import type { Collection } from './collections';
import type { PendingChange, PhotoPayload, RemoteAdapter, RemoteRecord } from './remote';

const TABLE = 'records';
const BUCKET = 'photos';
const PAGE_SIZE = 1000;

interface RecordRow {
  collection: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  updated_at: string;
}

export class SupabaseRemote implements RemoteAdapter {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async pull(since: string | null): Promise<RemoteRecord[]> {
    const out: RemoteRecord[] = [];
    let from = 0;

    // Paged so a large first sync (every pub status, review and photo record)
    // can't be silently truncated by the API's row cap.
    for (;;) {
      let query = this.supabase
        .from(TABLE)
        .select('collection,id,data,deleted,updated_at')
        .order('updated_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (since) query = query.gte('updated_at', since);

      const { data, error } = await query;
      if (error) throw new Error(`Pull failed: ${error.message}`);

      const rows = (data ?? []) as RecordRow[];
      for (const row of rows) {
        out.push({
          collection: row.collection as Collection,
          id: row.id,
          data: row.data,
          updatedAt: row.updated_at,
          deleted: row.deleted,
        });
      }

      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return out;
  }

  async push(changes: PendingChange[]): Promise<void> {
    if (changes.length === 0) return;
    const rows = changes.map((c) => ({
      collection: c.collection,
      id: c.id,
      data: c.deleted ? null : c.data,
      deleted: c.deleted,
      // Left to the table's trigger so ordering always follows server time,
      // never a phone's clock.
    }));

    const { error } = await this.supabase.from(TABLE).upsert(rows, { onConflict: 'collection,id' });
    if (error) throw new Error(`Push failed: ${error.message}`);
  }

  async uploadPhoto(photoId: string, payload: PhotoPayload): Promise<void> {
    const uploads: Promise<void>[] = [
      this.uploadOne(`${photoId}/full`, payload.blob),
      this.uploadOne(`${photoId}/thumb`, payload.thumbBlob),
    ];
    await Promise.all(uploads);
  }

  private async uploadOne(path: string, blob: Blob): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'application/octet-stream',
    });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
  }

  async downloadPhoto(photoId: string): Promise<PhotoPayload | null> {
    const [full, thumb] = await Promise.all([
      this.supabase.storage.from(BUCKET).download(`${photoId}/full`),
      this.supabase.storage.from(BUCKET).download(`${photoId}/thumb`),
    ]);
    if (full.error || !full.data) return null;
    return {
      blob: full.data,
      // A missing thumbnail falls back to the full image rather than failing
      // the whole record.
      thumbBlob: thumb.data ?? full.data,
    };
  }

  async deletePhoto(photoId: string): Promise<void> {
    await this.supabase.storage.from(BUCKET).remove([`${photoId}/full`, `${photoId}/thumb`]);
  }

  subscribe(onChange: () => void): () => void {
    const channel = this.supabase
      .channel('records-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
      .subscribe();

    return () => {
      void this.supabase.removeChannel(channel);
    };
  }
}
