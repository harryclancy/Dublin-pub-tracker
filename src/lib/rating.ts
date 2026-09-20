import type { CategoryRatings, GuestReview, RatingCategoryKey, Review } from '../types';

export const RATING_CATEGORIES: { key: RatingCategoryKey; label: string }[] = [
  { key: 'comfort', label: 'Comfort & Layout' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'facilities', label: 'Facilities & Cleanliness' },
  { key: 'atmosphere', label: 'Atmosphere' },
  { key: 'service', label: 'Service' },
  { key: 'personalExperience', label: 'Personal Experience' },
];

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function average(vals: number[]): number | null {
  if (!vals.length) return null;
  return round2(vals.reduce((s, v) => s + v, 0) / vals.length);
}

/** The completed (non-null/undefined) category values only — an unrated
 * category is excluded, never treated as 0. */
export function categoryValues(categories?: CategoryRatings | null): number[] {
  if (!categories) return [];
  return RATING_CATEGORIES.map((c) => categories[c.key]).filter((v): v is number => typeof v === 'number');
}

/** A person's own overall rating: the average of whichever categories they've
 * completed. Falls back to their legacy single rating when they haven't used
 * the category system for this pub yet (or at all), so reviews saved before
 * this feature existed keep displaying the same overall score they always did. */
export function personOverallRating(review: Review | null | undefined): number | null {
  if (!review) return null;
  const cats = categoryValues(review.categories);
  if (cats.length > 0) return average(cats);
  return review.rating ?? null;
}

/** The individual rating values a person contributes to the Combined Rating
 * pool: every completed category if they have any, else their single legacy
 * rating as one data point. */
function contributedValues(review: Review | null | undefined): number[] {
  if (!review) return [];
  const cats = categoryValues(review.categories);
  if (cats.length > 0) return cats;
  return review.rating != null ? [review.rating] : [];
}

/** Combined Rating = average of every completed Harry + Ava category rating
 * (e.g. 12 values if both rated all six). Pubs still on the legacy single-
 * rating system combine exactly as they always did. Never includes a guest
 * review — guest ratings are supplementary and shown separately. */
export function combinedOverallRating(harry: Review | null | undefined, ava: Review | null | undefined): number | null {
  const pool = [...contributedValues(harry), ...contributedValues(ava)];
  return average(pool);
}

export function guestOverallRating(guest: GuestReview | null | undefined): number | null {
  if (!guest) return null;
  return average(categoryValues(guest.categories));
}

/** @deprecated superseded by combinedOverallRating, kept only in case older
 * code paths still reference the simple two-value average. */
export function combineRatings(a: number | null | undefined, b: number | null | undefined): number | null {
  const vals = [a, b].filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 4) / 4;
}

export function formatRating(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Number.isInteger(v)) return v.toFixed(0);
  if ((v * 4) % 1 === 0 && (v * 2) % 1 !== 0) return v.toFixed(2); // quarter step (e.g. combined)
  return v.toFixed(1);
}

export function ratingLabel(v: number | null | undefined): string {
  if (v == null) return 'Not rated';
  return `${v % 1 === 0 ? v : v.toFixed(2)} / 5`;
}
