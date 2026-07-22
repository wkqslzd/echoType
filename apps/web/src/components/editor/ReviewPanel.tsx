import { useEffect, useState } from 'react';
import {
  formatReviewBanner,
  formatReviewExpandToggle,
  truncateForDisplay,
} from './annotationMessages';
import type { DraftAnnotation } from './useCourseEditor';

export type ReviewReanchorCommand = {
  type: 'reanchor';
  localId: number;
  nonce: number;
};

interface ReviewPanelProps {
  items: DraftAnnotation[];
  onFocus: (localId: number) => void;
  onReselect: (localId: number) => void;
  onDelete: (localId: number) => void;
}

const NOTE_PREVIEW_MAX = 48;
const WAS_PREVIEW_MAX = 60;
const SCROLL_THRESHOLD = 5;

export function ReviewPanel({ items, onFocus, onReselect, onDelete }: ReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (count <= 1) setExpanded(false);
  }, [count]);

  if (count === 0) return null;

  const visibleItems = expanded || count === 1 ? items : items.slice(0, 1);
  const hiddenCount = count - 1;
  const listScrollable = expanded && count > SCROLL_THRESHOLD;

  return (
    <div
      className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-serika-main/50 dark:bg-serika-main/15 dark:text-serika-main"
      data-testid="review-banner"
    >
      <p className="font-medium text-amber-800 dark:text-serika-main">{formatReviewBanner(count)}</p>

      <ul
        className={`mt-2 space-y-2${listScrollable ? ' max-h-60 overflow-y-auto pr-1' : ''}`}
        data-testid="review-list"
      >
        {visibleItems.map((item) => (
          <li
            key={item.localId}
            className="rounded border border-amber-200 bg-white px-2.5 py-2 dark:border-serika-main/50 dark:bg-serika-surface"
            data-testid={`review-item-${item.localId}`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onFocus(item.localId)}
            >
              <p className="text-slate-800 dark:text-serika-text" title={item.noteText}>
                <span className="text-slate-500 dark:text-serika-sub">Note: </span>
                {truncateForDisplay(item.noteText, NOTE_PREVIEW_MAX) || '—'}
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-serika-sub" title={item.anchoredText}>
                <span className="text-slate-500 dark:text-serika-sub">Was: </span>
                &ldquo;{truncateForDisplay(item.anchoredText, WAS_PREVIEW_MAX)}&rdquo;
              </p>
            </button>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-serika-main/50 dark:bg-serika-main/15 dark:text-serika-main dark:hover:bg-serika-main/25"
                onClick={() => onReselect(item.localId)}
                data-testid={`review-reselect-${item.localId}`}
              >
                Reselect
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
                onClick={() => onDelete(item.localId)}
                data-testid={`review-delete-${item.localId}`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {count > 1 && (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-amber-800 underline hover:text-amber-950 dark:text-serika-main dark:hover:text-serika-main"
          onClick={() => setExpanded((v) => !v)}
          data-testid="review-expand-toggle"
        >
          {formatReviewExpandToggle(hiddenCount, expanded)}
        </button>
      )}
    </div>
  );
}
