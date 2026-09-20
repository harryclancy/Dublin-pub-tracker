import type { ReactNode } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { DEFAULT_VISITED_FILTERS, type VisitedByFilter, type VisitedFilters, type VisitedSort } from '../../lib/visitedFilters';

interface VisitedFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: VisitedFilters;
  onChange: (f: VisitedFilters) => void;
  areas: string[];
}

const SORT_OPTIONS: { value: VisitedSort; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
];

const VISITED_BY_OPTIONS: { value: VisitedByFilter; label: string }[] = [
  { value: 'all', label: 'Anyone' },
  { value: 'harry', label: 'Harry' },
  { value: 'ava', label: 'Ava' },
  { value: 'both', label: 'Both' },
];

export function VisitedFilterSheet({ open, onClose, filters, onChange, areas }: VisitedFilterSheetProps) {
  function set<K extends keyof VisitedFilters>(key: K, value: VisitedFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Filter Visited Pubs" maxHeight="90vh">
      <div className="space-y-6 pb-6">
        <section>
          <FieldLabel>Sort by</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => set('sort', o.value)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition active:scale-95 ${
                  filters.sort === o.value ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white text-ink'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <FieldLabel>Visited by</FieldLabel>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/5 p-1">
            {VISITED_BY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => set('visitedBy', o.value)}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  filters.visitedBy === o.value ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <FieldLabel>Area</FieldLabel>
          <select
            value={filters.area ?? ''}
            onChange={(e) => set('area', e.target.value || null)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink"
          >
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </section>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onChange(DEFAULT_VISITED_FILTERS)}
            className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-ink"
          >
            Clear Filters
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-brand-800 py-3 text-sm font-semibold text-white">
            Show results
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</div>;
}
