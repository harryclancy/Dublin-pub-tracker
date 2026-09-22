import { db } from '../db/database';
import { enqueueEverything } from '../sync/outbox';
import { blobToDataUrl, dataUrlToBlob } from './photos';
import type { AppSettings, Drink, DrinkPhoto, GuestReview, Pub, PubCrawl, PubEdit, PubStatus, Review, Visit } from '../types';

const BACKUP_VERSION = 3;

interface SerializedPhoto {
  id: string;
  drinkId: string;
  blob: string; // data URL
  thumbBlob: string; // data URL
  createdAt: string;
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  app: 'dublin-pub-tracker';
  data: {
    statuses: PubStatus[];
    reviews: Review[];
    visits: Visit[];
    drinks: Drink[];
    photos: SerializedPhoto[];
    edits: PubEdit[];
    crawls: PubCrawl[];
    settings: AppSettings[];
    customPubs?: Pub[]; // added in v2 — optional so v1 backups still import cleanly
    guestReviews?: GuestReview[]; // added in v3 — optional so v1/v2 backups still import cleanly
  };
}

export async function exportBackup(): Promise<Blob> {
  const [statuses, reviews, visits, drinks, photos, edits, crawls, settings, customPubs, guestReviews] = await Promise.all([
    db.statuses.toArray(),
    db.reviews.toArray(),
    db.visits.toArray(),
    db.drinks.toArray(),
    db.photos.toArray(),
    db.edits.toArray(),
    db.crawls.toArray(),
    db.settings.toArray(),
    db.customPubs.toArray(),
    db.guestReviews.toArray(),
  ]);

  const serializedPhotos: SerializedPhoto[] = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      drinkId: p.drinkId,
      blob: await blobToDataUrl(p.blob),
      thumbBlob: await blobToDataUrl(p.thumbBlob),
      createdAt: p.createdAt,
    }))
  );

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'dublin-pub-tracker',
    data: { statuses, reviews, visits, drinks, photos: serializedPhotos, edits, crawls, settings, customPubs, guestReviews },
  };

  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export function downloadBackup(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `dublin-pub-tracker-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface BackupSummary {
  visits: number;
  drinks: number;
  photos: number;
  reviews: number;
  crawls: number;
  visitedPubs: number;
  customPubs: number;
  guestReviews: number;
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    visits: backup.data.visits.length,
    drinks: backup.data.drinks.length,
    photos: backup.data.photos.length,
    reviews: backup.data.reviews.length,
    crawls: backup.data.crawls.length,
    visitedPubs: backup.data.statuses.filter((s) => s.visited).length,
    customPubs: backup.data.customPubs?.length ?? 0,
    guestReviews: backup.data.guestReviews?.length ?? 0,
  };
}

export async function parseBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.app !== 'dublin-pub-tracker' || !parsed.data) {
    throw new Error('This file does not look like a Dublin Pub Tracker backup.');
  }
  return parsed as BackupFile;
}

/** Replaces all local user data with the contents of the backup. Destructive — the
 * caller (Settings screen) is responsible for confirming with the user first. */
export async function importBackup(backup: BackupFile): Promise<void> {
  const photos: DrinkPhoto[] = await Promise.all(
    backup.data.photos.map(async (p) => ({
      id: p.id,
      drinkId: p.drinkId,
      blob: await dataUrlToBlob(p.blob),
      thumbBlob: await dataUrlToBlob(p.thumbBlob),
      createdAt: p.createdAt,
    }))
  );

  await db.transaction(
    'rw',
    [db.statuses, db.reviews, db.visits, db.drinks, db.photos, db.edits, db.crawls, db.settings, db.customPubs, db.guestReviews],
    async () => {
      await Promise.all([
        db.statuses.clear(),
        db.reviews.clear(),
        db.visits.clear(),
        db.drinks.clear(),
        db.photos.clear(),
        db.edits.clear(),
        db.crawls.clear(),
        db.settings.clear(),
        db.customPubs.clear(),
        db.guestReviews.clear(),
      ]);
      await Promise.all([
        db.statuses.bulkPut(backup.data.statuses),
        db.reviews.bulkPut(backup.data.reviews),
        db.visits.bulkPut(backup.data.visits),
        db.drinks.bulkPut(backup.data.drinks),
        db.photos.bulkPut(photos),
        db.edits.bulkPut(backup.data.edits),
        db.crawls.bulkPut(backup.data.crawls),
        db.settings.bulkPut(backup.data.settings),
        db.customPubs.bulkPut(backup.data.customPubs ?? []),
        db.guestReviews.bulkPut(backup.data.guestReviews ?? []),
      ]);
    }
  );

  // Bulk clear/put operations bypass Dexie's per-row hooks, so the restored
  // state is queued explicitly — otherwise an import would stay stuck on this
  // phone and never reach the shared database.
  await enqueueEverything();
}
