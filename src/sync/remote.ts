import type { Collection } from './collections';

export interface RemoteRecord {
  collection: Collection;
  id: string;
  /** null when the record is a tombstone. */
  data: Record<string, unknown> | null;
  /** Server-assigned ISO timestamp — the ordering authority for the sync cursor. */
  updatedAt: string;
  deleted: boolean;
}

export interface PendingChange {
  collection: Collection;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
}

export interface PhotoPayload {
  blob: Blob;
  thumbBlob: Blob;
}

/**
 * Everything the sync engine needs from a backend. Keeping this as an interface
 * means the engine can be exercised against an in-process fake in tests, and
 * the real Supabase implementation stays thin enough to reason about.
 */
export interface RemoteAdapter {
  /** Records changed at or after `since` (null = everything). */
  pull(since: string | null): Promise<RemoteRecord[]>;
  push(changes: PendingChange[]): Promise<void>;
  uploadPhoto(photoId: string, payload: PhotoPayload): Promise<void>;
  downloadPhoto(photoId: string): Promise<PhotoPayload | null>;
  deletePhoto(photoId: string): Promise<void>;
  /** Fires whenever anything changes remotely. Returns an unsubscribe fn. */
  subscribe(onChange: () => void): () => void;
}
