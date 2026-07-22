import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import type { CategoryDTO, CourseMode } from '@echotype/shared';
import { api } from '../../lib/api';

const GAP_PX = 8;
const VIEWPORT_PADDING_PX = 16;

type CollectionPickerModalProps = {
  courseMode: CourseMode;
  title: string;
  excludeCategoryId?: string;
  /** When set, panel is placed below the anchor (viewport horizontal center), flipping above if needed. */
  anchorRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onPick: (category: CategoryDTO) => void;
  onNewCollection?: () => void;
};

function computeAnchoredPosition(anchor: HTMLElement, panel: HTMLElement) {
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const panelWidth = panelRect.width;
  const panelHeight = panelRect.height;

  let left = (window.innerWidth - panelWidth) / 2;
  const maxLeft = window.innerWidth - panelWidth - VIEWPORT_PADDING_PX;
  left = Math.max(VIEWPORT_PADDING_PX, Math.min(left, maxLeft));

  let top = anchorRect.bottom + GAP_PX;
  const spaceBelow = window.innerHeight - VIEWPORT_PADDING_PX - top;
  if (spaceBelow < panelHeight) {
    const aboveTop = anchorRect.top - GAP_PX - panelHeight;
    if (aboveTop >= VIEWPORT_PADDING_PX) {
      top = aboveTop;
    } else {
      top = Math.max(
        VIEWPORT_PADDING_PX,
        Math.min(top, window.innerHeight - panelHeight - VIEWPORT_PADDING_PX),
      );
    }
  }

  return { top, left };
}

export function CollectionPickerModal({
  courseMode,
  title,
  excludeCategoryId,
  anchorRef,
  onClose,
  onPick,
  onNewCollection,
}: CollectionPickerModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchoredStyle, setAnchoredStyle] = useState<{ top: number; left: number } | null>(null);
  const [anchoredReady, setAnchoredReady] = useState(!anchorRef);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', courseMode, '', 'createdAt_desc'],
    queryFn: () => api.listCategories(courseMode, { sort: 'createdAt_desc' }),
  });

  const options = (categories ?? []).filter((c) => c.id !== excludeCategoryId);
  const useAnchor = !!anchorRef;

  useLayoutEffect(() => {
    if (!useAnchor) {
      setAnchoredStyle(null);
      setAnchoredReady(true);
      return;
    }

    setAnchoredReady(false);

    function updatePosition() {
      const anchor = anchorRef?.current;
      const panel = panelRef.current;
      if (!anchor || !panel) {
        setAnchoredStyle(null);
        setAnchoredReady(true);
        return;
      }
      setAnchoredStyle(computeAnchoredPosition(anchor, panel));
      setAnchoredReady(true);
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, useAnchor, isLoading, options.length]);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      className={`w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:border dark:border-serika-border dark:bg-serika-surface${
        useAnchor ? ' fixed' : ''
      }${useAnchor && !anchoredReady ? ' invisible' : ''}`}
      style={useAnchor && anchoredStyle ? { top: anchoredStyle.top, left: anchoredStyle.left } : undefined}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-semibold dark:text-serika-text">{title}</h2>
      <div className="mt-4 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-serika-sub">Loading…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-serika-sub">No collections yet.</p>
        ) : (
          <ul className="space-y-1">
            {options.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50 dark:text-serika-text dark:hover:bg-serika-raised"
                >
                  {c.name}
                  <span className="ml-2 text-xs text-slate-400 dark:text-serika-sub">
                    {c.courseCount} course{c.courseCount === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {onNewCollection && (
          <button
            type="button"
            onClick={onNewCollection}
            className="mr-auto rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
          >
            New collection…
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const backdrop = (
    <div
      className={`fixed inset-0 z-50 bg-black/40${useAnchor ? '' : ' flex items-center justify-center p-4'}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {panel}
    </div>
  );

  return createPortal(backdrop, document.body);
}
