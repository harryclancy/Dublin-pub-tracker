import type { PubWithComputed } from '../types';

export type VisitedSort = 'recent' | 'oldest' | 'highest' | 'lowest';
export type VisitedByFilter = 'all' | 'harry' | 'ava' | 'both';

export interface VisitedFilters {
  sort: VisitedSort;
  area: string | null;
  visitedBy: VisitedByFilter;
}

export const DEFAULT_VISITED_FILTERS: VisitedFilters = {
  sort: 'recent',
  area: null,
  visitedBy: 'all',
};

export function isVisitedFiltersActive(f: VisitedFilters): boolean {
  return f.sort !== 'recent' || !!f.area || f.visitedBy !== 'all';
}

export function countActiveVisitedFilters(f: VisitedFilters): number {
  let n = 0;
  if (f.sort !== 'recent') n++;
  if (f.area) n++;
  if (f.visitedBy !== 'all') n++;
  return n;
}

export function applyVisitedByFilter(pubs: PubWithComputed[], visitedBy: VisitedByFilter): PubWithComputed[] {
  if (visitedBy === 'all') return pubs;
  return pubs.filter((p) => {
    if (visitedBy === 'harry') return p.visitedByHarry;
    if (visitedBy === 'ava') return p.visitedByAva;
    return p.visitedByHarry && p.visitedByAva;
  });
}

export function sortVisited(pubs: PubWithComputed[], sort: VisitedSort): PubWithComputed[] {
  const sorted = [...pubs];
  switch (sort) {
    case 'recent':
      sorted.sort((a, b) => (b.lastVisitDate ?? b.status.firstVisitDate ?? '').localeCompare(a.lastVisitDate ?? a.status.firstVisitDate ?? ''));
      break;
    case 'oldest':
      sorted.sort((a, b) => (a.status.firstVisitDate ?? '').localeCompare(b.status.firstVisitDate ?? ''));
      break;
    case 'highest':
      sorted.sort((a, b) => (b.combinedRating ?? -1) - (a.combinedRating ?? -1));
      break;
    case 'lowest':
      sorted.sort((a, b) => (a.combinedRating ?? 6) - (b.combinedRating ?? 6));
      break;
  }
  return sorted;
}
