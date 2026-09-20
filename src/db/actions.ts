import { db, emptyStatus } from './database';
import { newId } from '../lib/id';
import { compressForStorage, makeThumbnail } from '../lib/photos';
import { nearestArea } from '../lib/areas';
import { pubDirectionsUrl, pubGoogleMapsUrl } from '../lib/googleMaps';
import type {
  CategoryNotes,
  CategoryRatings,
  GuestReview,
  Person,
  PersonOrBoth,
  Pub,
  PubEdit,
  PubStatus,
  RatingCategoryKey,
  Review,
  Visit,
} from '../types';

export async function getStatus(pubId: string): Promise<PubStatus> {
  const existing = await db.statuses.get(pubId);
  return existing ?? emptyStatus(pubId);
}

async function ensureStatus(pubId: string): Promise<PubStatus> {
  const existing = await db.statuses.get(pubId);
  if (existing) return existing;
  const fresh = emptyStatus(pubId);
  await db.statuses.put(fresh);
  return fresh;
}

export async function setVisited(pubId: string, visited: boolean, date?: string): Promise<void> {
  const status = await ensureStatus(pubId);
  const next: PubStatus = {
    ...status,
    visited,
    firstVisitDate: visited ? status.firstVisitDate ?? date ?? new Date().toISOString().slice(0, 10) : status.firstVisitDate,
    updatedAt: new Date().toISOString(),
  };
  await db.statuses.put(next);
}

export async function toggleFavourite(pubId: string, person: Person): Promise<void> {
  const status = await ensureStatus(pubId);
  const key = person === 'harry' ? 'favouriteHarry' : 'favouriteAva';
  await db.statuses.put({ ...status, [key]: !status[key], updatedAt: new Date().toISOString() });
}

export async function toggleWantToVisit(pubId: string): Promise<void> {
  const status = await ensureStatus(pubId);
  await db.statuses.put({ ...status, wantToVisit: !status.wantToVisit, updatedAt: new Date().toISOString() });
}

/** Merge-safe write for a Harry/Ava review — always reads the existing row
 * first so saving one field (e.g. the general comment) never wipes out
 * another (e.g. category ratings/notes already saved), and vice versa. */
async function upsertReviewFields(
  pubId: string,
  person: Person,
  changes: Partial<Pick<Review, 'rating' | 'comment' | 'categories' | 'categoryNotes'>>
): Promise<void> {
  const existing = await db.reviews.get([pubId, person]);
  const next: Review = {
    pubId,
    person,
    rating: existing?.rating ?? null,
    comment: existing?.comment ?? null,
    categories: existing?.categories ?? null,
    categoryNotes: existing?.categoryNotes ?? null,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  await db.reviews.put(next);
}

export async function upsertReview(pubId: string, person: Person, rating: number | null, comment: string | null): Promise<void> {
  await upsertReviewFields(pubId, person, { rating, comment });
}

export async function setReviewCategoryRating(
  pubId: string,
  person: Person,
  category: RatingCategoryKey,
  value: number | null
): Promise<void> {
  const existing = await db.reviews.get([pubId, person]);
  const categories: CategoryRatings = { ...(existing?.categories ?? {}) };
  if (value == null) delete categories[category];
  else categories[category] = value;
  await upsertReviewFields(pubId, person, { categories });
}

export async function setReviewCategoryNote(
  pubId: string,
  person: Person,
  category: RatingCategoryKey,
  note: string | null
): Promise<void> {
  const existing = await db.reviews.get([pubId, person]);
  const categoryNotes: CategoryNotes = { ...(existing?.categoryNotes ?? {}) };
  const trimmed = note?.trim();
  if (trimmed) categoryNotes[category] = trimmed;
  else delete categoryNotes[category];
  await upsertReviewFields(pubId, person, { categoryNotes });
}

async function ensureGuestReview(pubId: string): Promise<GuestReview> {
  const existing = await db.guestReviews.get(pubId);
  if (existing) return existing;
  const fresh: GuestReview = { pubId, guestName: null, categories: {}, categoryNotes: {}, updatedAt: new Date().toISOString() };
  await db.guestReviews.put(fresh);
  return fresh;
}

export async function addGuestReview(pubId: string): Promise<void> {
  await ensureGuestReview(pubId);
}

export async function setGuestName(pubId: string, guestName: string | null): Promise<void> {
  const existing = await ensureGuestReview(pubId);
  await db.guestReviews.put({ ...existing, guestName: guestName?.trim() || null, updatedAt: new Date().toISOString() });
}

export async function setGuestCategoryRating(pubId: string, category: RatingCategoryKey, value: number | null): Promise<void> {
  const existing = await ensureGuestReview(pubId);
  const categories: CategoryRatings = { ...existing.categories };
  if (value == null) delete categories[category];
  else categories[category] = value;
  await db.guestReviews.put({ ...existing, categories, updatedAt: new Date().toISOString() });
}

export async function setGuestCategoryNote(pubId: string, category: RatingCategoryKey, note: string | null): Promise<void> {
  const existing = await ensureGuestReview(pubId);
  const categoryNotes: CategoryNotes = { ...existing.categoryNotes };
  const trimmed = note?.trim();
  if (trimmed) categoryNotes[category] = trimmed;
  else delete categoryNotes[category];
  await db.guestReviews.put({ ...existing, categoryNotes, updatedAt: new Date().toISOString() });
}

/** Removes only the guest review for this pub — never touches Harry's or
 * Ava's reviews, the pub itself, its visits, or any photos. */
export async function deleteGuestReview(pubId: string): Promise<void> {
  await db.guestReviews.delete(pubId);
}

export interface NewVisitInput {
  pubId: string;
  date: string;
  time: string | null;
  who: PersonOrBoth;
  notes: string | null;
}

export async function addVisit(input: NewVisitInput): Promise<Visit> {
  const visit: Visit = {
    id: newId(),
    pubId: input.pubId,
    date: input.date,
    time: input.time,
    who: input.who,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  await db.visits.put(visit);

  const status = await ensureStatus(input.pubId);
  if (!status.visited || !status.firstVisitDate || input.date < status.firstVisitDate) {
    await db.statuses.put({
      ...status,
      visited: true,
      firstVisitDate: !status.firstVisitDate || input.date < status.firstVisitDate ? input.date : status.firstVisitDate,
      updatedAt: new Date().toISOString(),
    });
  }
  return visit;
}

export async function updateVisit(id: string, changes: Partial<NewVisitInput>): Promise<void> {
  await db.visits.update(id, changes);
}

export async function deleteVisit(id: string): Promise<void> {
  const drinks = await db.drinks.where('visitId').equals(id).toArray();
  for (const d of drinks) {
    await deleteDrink(d.id);
  }
  await db.visits.delete(id);
}

export interface NewDrinkInput {
  visitId: string;
  name: string;
  rating: number | null;
  comment: string | null;
  photos: File[];
}

export async function addDrink(input: NewDrinkInput): Promise<string> {
  const drinkId = newId();
  await db.drinks.put({
    id: drinkId,
    visitId: input.visitId,
    name: input.name,
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date().toISOString(),
  });

  for (const file of input.photos) {
    await addPhotoToDrink(drinkId, file);
  }

  return drinkId;
}

export async function addPhotoToDrink(drinkId: string, file: File | Blob): Promise<void> {
  const [full, thumb] = await Promise.all([compressForStorage(file), makeThumbnail(file)]);
  await db.photos.put({
    id: newId(),
    drinkId,
    blob: full,
    thumbBlob: thumb,
    createdAt: new Date().toISOString(),
  });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

export async function updateDrink(id: string, changes: Partial<Pick<import('../types').Drink, 'name' | 'rating' | 'comment'>>): Promise<void> {
  await db.drinks.update(id, changes);
}

export async function deleteDrink(id: string): Promise<void> {
  const photos = await db.photos.where('drinkId').equals(id).toArray();
  await db.photos.bulkDelete(photos.map((p) => p.id));
  await db.drinks.delete(id);
}

export async function upsertPubEdit(pubId: string, changes: Partial<Omit<PubEdit, 'pubId' | 'updatedAt'>>): Promise<void> {
  const existing = await db.edits.get(pubId);
  const next: PubEdit = {
    pubId,
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  await db.edits.put(next);
}

export async function createCrawl(name: string, pubIds: string[]): Promise<string> {
  const id = newId();
  await db.crawls.put({
    id,
    name,
    stops: pubIds.map((pubId, i) => ({ pubId, order: i })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

export async function updateCrawlStops(id: string, pubIds: string[]): Promise<void> {
  const crawl = await db.crawls.get(id);
  if (!crawl) return;
  await db.crawls.put({
    ...crawl,
    stops: pubIds.map((pubId, i) => ({ pubId, order: i })),
    updatedAt: new Date().toISOString(),
  });
}

export async function renameCrawl(id: string, name: string): Promise<void> {
  await db.crawls.update(id, { name, updatedAt: new Date().toISOString() });
}

export async function deleteCrawl(id: string): Promise<void> {
  await db.crawls.delete(id);
}

export interface NewCustomPubInput {
  name: string;
  lat: number;
  lon: number;
  area?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
}

/** Adds a real pub the seed dataset is missing. Stored separately from the
 * read-only static list so it survives dataset refreshes, but behaves
 * identically everywhere else (map, filters, reviews, visits, crawls). */
export async function addCustomPub(input: NewCustomPubInput): Promise<Pub> {
  const suggested = nearestArea(input.lat, input.lon);
  const pub: Pub = {
    id: `custom-${newId()}`,
    name: input.name.trim(),
    lat: input.lat,
    lon: input.lon,
    area: input.area?.trim() || suggested.name,
    district: suggested.district,
    region: suggested.region,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    openingHours: null,
    tags: ['pub'],
    image: null,
    source: 'user-added',
    googleMapsUrl: pubGoogleMapsUrl(input.name.trim(), input.lat, input.lon),
    directionsUrl: pubDirectionsUrl(input.lat, input.lon),
    createdAt: new Date().toISOString(),
  };
  await db.customPubs.put(pub);
  return pub;
}

/** Removes a user-added pub entirely, along with any visits/drinks/photos,
 * reviews, status and edits recorded against it. Only ever offered for pubs
 * with source "user-added" — the seed dataset's real pubs aren't deletable. */
export async function deleteCustomPub(pubId: string): Promise<void> {
  const visits = await db.visits.where('pubId').equals(pubId).toArray();
  for (const visit of visits) {
    await deleteVisit(visit.id);
  }
  await Promise.all([
    db.customPubs.delete(pubId),
    db.statuses.delete(pubId),
    db.edits.delete(pubId),
    db.reviews.where('pubId').equals(pubId).delete(),
    db.guestReviews.delete(pubId),
  ]);
}
