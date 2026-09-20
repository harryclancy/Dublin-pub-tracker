import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { db } from '../../db/database';
import { addGuestReview, deleteGuestReview, setGuestCategoryNote, setGuestCategoryRating, setGuestName } from '../../db/actions';
import { RATING_CATEGORIES, formatRating, guestOverallRating } from '../../lib/rating';
import type { RatingCategoryKey } from '../../types';
import { CategoryRatingRow } from './CategoryRatingRow';
import { RatingStars } from '../ui/RatingStars';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

/** The optional third review for a pub visited with someone else. Lives
 * entirely in its own IndexedDB table (see db/database.ts) so it can never
 * collide with, overwrite, or count toward Harry's or Ava's data — it's
 * fetched here, not through PubDataContext, specifically so it never leaks
 * into the Home page, pub cards, the Visited list, or the main Combined
 * Rating, all of which read only from the context's computed pub objects. */
export function GuestReviewSection({ pubId }: { pubId: string }) {
  // Dexie's `.get()` resolves to `undefined` when no row exists, which would
  // otherwise be indistinguishable from "still loading" (useLiveQuery's own
  // pending state). Passing `null` as the explicit default disambiguates the
  // two: `null` means still loading, `undefined` means confirmed no guest
  // review yet — the case that should show the "+ Add Guest Review" button.
  const guest = useLiveQuery(() => db.guestReviews.get(pubId), [pubId], null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setNameDraft(guest?.guestName ?? '');
    setNameDirty(false);
  }, [guest?.guestName]);

  if (guest === null) return null; // still loading

  if (!guest) {
    return (
      <button
        onClick={() => addGuestReview(pubId)}
        className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-line bg-white/60 py-3 text-sm font-semibold text-brand-700"
      >
        <Plus size={15} /> Add Guest Review
      </button>
    );
  }

  const overall = guestOverallRating(guest);

  async function saveName() {
    await setGuestName(pubId, nameDraft);
    setNameDirty(false);
  }

  async function handleCategoryChange(category: RatingCategoryKey, value: number | null) {
    await setGuestCategoryRating(pubId, category, value);
  }

  async function handleNoteSave(category: RatingCategoryKey, note: string | null) {
    await setGuestCategoryNote(pubId, category, note);
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
          <UserRound size={14} className="text-ink-soft" />
          {guest.guestName || 'Guest'}
        </h3>
      </div>

      <input
        value={nameDraft}
        onChange={(e) => {
          setNameDraft(e.target.value);
          setNameDirty(true);
        }}
        onBlur={() => nameDirty && saveName()}
        placeholder="Guest's name (optional)"
        className="mb-3 h-10 w-full rounded-xl border border-line bg-paper-dim/50 px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand-600 focus:outline-none"
      />

      {overall != null && (
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-brand-800">
          <RatingStars value={overall} size={14} /> {formatRating(overall)} overall
        </div>
      )}

      <div>
        {RATING_CATEGORIES.map((cat) => (
          <CategoryRatingRow
            key={cat.key}
            label={cat.label}
            value={guest.categories[cat.key] ?? null}
            onChange={(v) => handleCategoryChange(cat.key, v)}
            note={guest.categoryNotes[cat.key] ?? null}
            onNoteSave={(n) => handleNoteSave(cat.key, n)}
          />
        ))}
      </div>

      <button
        onClick={() => setConfirmRemove(true)}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"
      >
        <Trash2 size={13} /> Remove Guest Review
      </button>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this guest review?"
        description="This only removes the guest's ratings and notes. It never affects Harry's review, Ava's review, or anything else about this pub."
        confirmLabel="Remove guest review"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          await deleteGuestReview(pubId);
          setConfirmRemove(false);
          toast.show('Guest review removed');
        }}
      />
    </div>
  );
}
