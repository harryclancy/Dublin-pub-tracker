// Core domain types for Dublin Pub Tracker.
// "Static" pub facts (name, coords, area…) live in src/data/pubs.json and are
// loaded read-only. Everything a user does — visits, ratings, photos, favourites —
// is user-generated data stored in IndexedDB (see src/db).

export type Person = 'harry' | 'ava';
export type PersonOrBoth = Person | 'both';

export interface Pub {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area: string;
  district: string;
  region: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  tags: string[];
  image: string | null;
  source: string;
  googleMapsUrl: string;
  directionsUrl: string;
  createdAt: string;
}

/** User corrections layered on top of the read-only Pub record. */
export interface PubEdit {
  pubId: string;
  name?: string;
  area?: string;
  district?: string;
  address?: string;
  website?: string;
  phone?: string;
  notes?: string;
  imageOverride?: string; // data URL or remote URL supplied by the user
  updatedAt: string;
}

export interface DrinkPhoto {
  id: string;
  drinkId: string;
  blob: Blob;
  thumbBlob: Blob;
  createdAt: string;
}

export interface Drink {
  id: string;
  visitId: string;
  name: string;
  rating: number | null; // 0-5, half steps
  comment: string | null;
  createdAt: string;
}

export interface Visit {
  id: string;
  pubId: string;
  date: string; // ISO date (yyyy-mm-dd)
  time: string | null; // HH:mm
  who: PersonOrBoth;
  notes: string | null;
  createdAt: string;
}

/** The six categories Harry, Ava (and an optional guest) rate a pub on. */
export type RatingCategoryKey =
  | 'comfort'
  | 'drinks'
  | 'facilities'
  | 'atmosphere'
  | 'service'
  | 'personalExperience';

export type CategoryRatings = Partial<Record<RatingCategoryKey, number>>;
export type CategoryNotes = Partial<Record<RatingCategoryKey, string>>;

export interface Review {
  pubId: string;
  person: Person;
  /** Legacy single overall rating, from before category ratings existed.
   * Never overwritten by the category system — kept as a fallback so pubs
   * rated before this feature still show a sensible overall/combined score
   * until someone rates their categories directly. */
  rating: number | null; // 0-5, half-star steps
  /** General written review (unrelated to any one category). */
  comment: string | null;
  /** Per-category 0-5 half-star ratings. Optional/absent on older reviews —
   * absence (not 0) means "not yet rated" and is excluded from averages. */
  categories?: CategoryRatings | null;
  /** Optional per-category free-text notes, collapsed by default in the UI. */
  categoryNotes?: CategoryNotes | null;
  updatedAt: string;
}

/** A single optional third review for a pub visited with someone else.
 * Deliberately separate from Review (not a "person") so it can never be
 * confused with, or accidentally affect, Harry's or Ava's data. */
export interface GuestReview {
  pubId: string;
  guestName: string | null;
  categories: CategoryRatings;
  categoryNotes: CategoryNotes;
  updatedAt: string;
}

export interface PubStatus {
  pubId: string;
  visited: boolean;
  firstVisitDate: string | null;
  favouriteHarry: boolean;
  favouriteAva: boolean;
  wantToVisit: boolean;
  updatedAt: string;
}

export interface PubCrawlStop {
  pubId: string;
  order: number;
}

export interface PubCrawl {
  id: string;
  name: string;
  stops: PubCrawlStop[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: 'settings';
  hasSeenOnboarding: boolean;
  lastLocation: { lat: number; lon: number } | null;
}

export interface PubWithComputed extends Pub {
  status: PubStatus;
  edit: PubEdit | null;
  harryReview: Review | null;
  avaReview: Review | null;
  /** Harry's/Ava's own overall — category average when they've rated any
   * categories, else falling back to their legacy single rating. */
  harryOverall: number | null;
  avaOverall: number | null;
  /** Average of every completed Harry+Ava category rating (or, for pubs
   * rated before categories existed, their legacy ratings). Never includes
   * a guest review. */
  combinedRating: number | null;
  visitCount: number;
  lastVisitDate: string | null;
  visitedByHarry: boolean;
  visitedByAva: boolean;
  distanceKm: number | null;
  displayName: string;
  displayArea: string;
  displayAddress: string | null;
  displayImage: string | null;
}
