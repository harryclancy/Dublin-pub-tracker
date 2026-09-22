import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  Drink,
  DrinkPhoto,
  GuestReview,
  Pub,
  PubCrawl,
  PubEdit,
  PubStatus,
  Review,
  Visit,
} from '../types';

/**
 * All user-generated data lives here (IndexedDB via Dexie). Static pub facts
 * (name/coords/area) are NOT stored here — they're loaded read-only from
 * src/data/pubs.json — keeping "our data" cleanly separable for backup/export
 * and for a future cloud-sync layer to slot in without a schema change.
 */
export class PubTrackerDB extends Dexie {
  statuses!: Table<PubStatus, string>;
  reviews!: Table<Review, [string, string]>;
  visits!: Table<Visit, string>;
  drinks!: Table<Drink, string>;
  photos!: Table<DrinkPhoto, string>;
  edits!: Table<PubEdit, string>;
  crawls!: Table<PubCrawl, string>;
  settings!: Table<AppSettings, string>;
  customPubs!: Table<Pub, string>;
  guestReviews!: Table<GuestReview, string>;
  outbox!: Table<OutboxEntry, string>;
  syncMeta!: Table<SyncMetaEntry, string>;

  constructor() {
    super('dublin-pub-tracker');
    this.version(1).stores({
      statuses: 'pubId, visited, favouriteHarry, favouriteAva, wantToVisit',
      reviews: '[pubId+person], pubId, person',
      visits: 'id, pubId, date',
      drinks: 'id, visitId',
      photos: 'id, drinkId, createdAt',
      edits: 'pubId',
      crawls: 'id, updatedAt',
      settings: 'id',
    });
    // v2: user-added pubs (for real pubs missing from the seed dataset), kept
    // in their own table so they merge cleanly with the read-only static list.
    this.version(2).stores({
      customPubs: 'id, area, district',
    });
    // v3: six-category ratings live as plain extra fields on existing `reviews`
    // rows (no index/schema change needed, so existing rows are untouched) plus
    // one new table for the optional third "guest" review — kept entirely
    // separate from `reviews` so it can never collide with or overwrite
    // Harry's or Ava's data.
    this.version(3).stores({
      guestReviews: 'pubId',
    });
    // v4: cloud sync bookkeeping. `outbox` is a dirty-set of local rows waiting
    // to be pushed (one entry per row, latest state wins — the pusher reads the
    // live row rather than a snapshot). `syncMeta` holds the pull cursor and
    // one-off migration flags. Both are device-local and never synced.
    this.version(4).stores({
      outbox: 'key, queuedAt',
      syncMeta: 'key',
    });
  }
}

export interface OutboxEntry {
  /** `${collection}:${recordId}` — one pending entry per row. */
  key: string;
  collection: string;
  recordId: string;
  deleted: boolean;
  queuedAt: string;
}

export interface SyncMetaEntry {
  key: string;
  value: unknown;
}

export const db = new PubTrackerDB();

export function emptyStatus(pubId: string): PubStatus {
  return {
    pubId,
    visited: false,
    firstVisitDate: null,
    favouriteHarry: false,
    favouriteAva: false,
    wantToVisit: false,
    updatedAt: new Date().toISOString(),
  };
}
