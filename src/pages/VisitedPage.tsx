import { useMemo, useState } from 'react';
import { usePubData } from '../context/PubDataContext';
import { PageHeader } from '../components/layout/PageHeader';
import { PubCard } from '../components/pub/PubCard';
import { SearchBar } from '../components/pub/SearchBar';
import { VisitedFilterSheet } from '../components/pub/VisitedFilterSheet';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ListChecks, X } from 'lucide-react';
import {
  DEFAULT_VISITED_FILTERS,
  applyVisitedByFilter,
  countActiveVisitedFilters,
  isVisitedFiltersActive,
  sortVisited,
  type VisitedFilters,
} from '../lib/visitedFilters';

export function VisitedPage() {
  const { pubs } = usePubData();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<VisitedFilters>(DEFAULT_VISITED_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const allVisited = useMemo(() => pubs.filter((p) => p.status.visited), [pubs]);
  const visitedAreas = useMemo(() => Array.from(new Set(allVisited.map((p) => p.displayArea))).sort(), [allVisited]);

  const visited = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = allVisited.filter((p) => !q || p.displayName.toLowerCase().includes(q) || p.displayArea.toLowerCase().includes(q));
    if (filters.area) result = result.filter((p) => p.displayArea === filters.area);
    result = applyVisitedByFilter(result, filters.visitedBy);
    return sortVisited(result, filters.sort);
  }, [allVisited, search, filters]);

  const total = pubs.length;
  const pct = total ? (allVisited.length / total) * 100 : 0;
  const filtersActive = isVisitedFiltersActive(filters);

  return (
    <div>
      <PageHeader title="Visited" subtitle={`${allVisited.length} / ${total} Dublin pubs`} />
      <div className="space-y-4 px-4 pb-8 pt-4 sm:px-6">
        <div className="rounded-card bg-white p-4 shadow-card">
          <ProgressBar value={pct} />
          <div className="mt-2 text-xs font-medium text-ink-soft">{pct.toFixed(1)}% of Dublin complete</div>
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search visited pubs…"
          onFilterClick={() => setFilterOpen(true)}
          activeFilterCount={countActiveVisitedFilters(filters)}
        />

        {filtersActive && (
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3.5 py-2.5">
            <span className="text-xs font-semibold text-brand-900">
              Filtered · {visited.length} of {allVisited.length} shown
            </span>
            <button
              onClick={() => setFilters(DEFAULT_VISITED_FILTERS)}
              className="flex items-center gap-1 text-xs font-bold text-brand-700"
            >
              <X size={12} /> Clear Filters
            </button>
          </div>
        )}

        {visited.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={allVisited.length === 0 ? 'No visited pubs yet' : 'No pubs match these filters'}
            description={
              allVisited.length === 0
                ? "Mark a pub as visited from its detail page and it'll show up here in green."
                : 'Try widening your filters or clearing them.'
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visited.map((pub) => (
              <PubCard key={pub.id} pub={pub} />
            ))}
          </div>
        )}
      </div>

      <VisitedFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        areas={visitedAreas}
      />
    </div>
  );
}
