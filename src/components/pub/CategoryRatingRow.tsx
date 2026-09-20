import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { RatingStars } from '../ui/RatingStars';

interface CategoryRatingRowProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  note: string | null;
  onNoteSave: (note: string | null) => void;
}

/** One category's star rating plus a collapsed-by-default note field —
 * keeps six of these stacked from turning the review section into a wall
 * of always-open text boxes. */
export function CategoryRatingRow({ label, value, onChange, note, onNoteSave }: CategoryRatingRowProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const savedNoteRef = useRef(note ?? '');

  useEffect(() => {
    setDraft(note ?? '');
    savedNoteRef.current = note ?? '';
  }, [note]);

  function handleBlur() {
    if (draft !== savedNoteRef.current) {
      savedNoteRef.current = draft;
      onNoteSave(draft.trim() || null);
    }
  }

  return (
    <div className="border-b border-line/60 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <RatingStars
          value={value}
          interactive
          size={22}
          onChange={(v) => onChange(v === 0 ? null : v)}
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-brand-700"
        aria-expanded={open}
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {note ? 'Note added · edit' : 'Add note'}
      </button>
      {!open && note && <p className="mt-1 truncate text-xs text-ink-soft">{note}</p>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleBlur}
              rows={2}
              placeholder={`Optional note about ${label.toLowerCase()}…`}
              className="mt-2 w-full resize-none rounded-lg border border-line bg-paper-dim/50 p-2 text-xs text-ink placeholder:text-ink-soft/60 focus:border-brand-600 focus:outline-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
