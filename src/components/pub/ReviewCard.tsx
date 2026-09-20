import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { RatingStars } from '../ui/RatingStars';
import { CategoryRatingRow } from './CategoryRatingRow';
import { upsertReview, setReviewCategoryRating, setReviewCategoryNote } from '../../db/actions';
import type { Person, RatingCategoryKey, Review } from '../../types';
import { RATING_CATEGORIES, personOverallRating, formatRating } from '../../lib/rating';

interface ReviewCardProps {
  pubId: string;
  person: Person;
  review: Review | null;
}

const PERSON_LABEL: Record<Person, string> = { harry: 'Harry', ava: 'Ava' };

export function ReviewCard({ pubId, person, review }: ReviewCardProps) {
  const [comment, setComment] = useState(review?.comment ?? '');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setComment(review?.comment ?? '');
    setDirty(false);
  }, [review?.comment]);

  const overall = personOverallRating(review);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function saveComment() {
    await upsertReview(pubId, person, review?.rating ?? null, comment.trim() || null);
    setDirty(false);
    flashSaved();
  }

  async function handleCategoryChange(category: RatingCategoryKey, value: number | null) {
    await setReviewCategoryRating(pubId, person, category, value);
    flashSaved();
  }

  async function handleNoteSave(category: RatingCategoryKey, note: string | null) {
    await setReviewCategoryNote(pubId, person, category, note);
    flashSaved();
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-ink">{PERSON_LABEL[person]}</h3>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-visited">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

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
            value={review?.categories?.[cat.key] ?? null}
            onChange={(v) => handleCategoryChange(cat.key, v)}
            note={review?.categoryNotes?.[cat.key] ?? null}
            onNoteSave={(n) => handleNoteSave(cat.key, n)}
          />
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setDirty(true);
        }}
        onBlur={() => dirty && saveComment()}
        placeholder={`${PERSON_LABEL[person]}'s thoughts on this pub…`}
        rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-paper-dim/50 p-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand-600 focus:outline-none"
      />
    </div>
  );
}
