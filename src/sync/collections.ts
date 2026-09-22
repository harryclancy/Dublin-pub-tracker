import { db } from '../db/database';
import type { Table } from 'dexie';

/**
 * Every Dexie table whose contents belong to "our" shared data. Device-local
 * things (settings: onboarding flag, last known location) are deliberately
 * excluded — they're per-phone, not shared.
 */
export const SYNCED_COLLECTIONS = [
  'statuses',
  'reviews',
  'visits',
  'drinks',
  'photos',
  'edits',
  'crawls',
  'customPubs',
  'guestReviews',
] as const;

export type Collection = (typeof SYNCED_COLLECTIONS)[number];

/** Remote ids are flat strings; reviews are the only table with a compound key. */
export function remoteIdFor(collection: Collection, row: Record<string, unknown>): string {
  if (collection === 'reviews') return `${row.pubId}::${row.person}`;
  const key = localKeyFieldFor(collection);
  return String(row[key]);
}

function localKeyFieldFor(collection: Collection): string {
  switch (collection) {
    case 'statuses':
    case 'edits':
    case 'guestReviews':
      return 'pubId';
    default:
      return 'id';
  }
}

/** Turns a remote id back into the key Dexie needs for .delete(). */
export function localKeyFromRemoteId(collection: Collection, remoteId: string): string | [string, string] {
  if (collection === 'reviews') {
    const [pubId, person] = remoteId.split('::');
    return [pubId, person];
  }
  return remoteId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tableFor(collection: Collection): Table<any, any> {
  return db[collection] as unknown as Table<unknown, unknown>;
}
