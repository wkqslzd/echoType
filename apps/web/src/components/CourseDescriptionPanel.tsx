import { useLayoutEffect, useRef, useState } from 'react';
import { linkifyPlainText } from '../lib/linkifyPlainText';

type CourseDescriptionPanelProps = {
  description: string;
  /** Typing page: allow collapsing the panel with a Hide control. */
  hideable?: boolean;
  /** Typing page: start fully collapsed (Show description). */
  defaultHidden?: boolean;
};

/** Typing-page description: one line by default; expand only when text overflows. */
export function CourseDescriptionPanel({
  description,
  hideable = false,
  defaultHidden = false,
}: CourseDescriptionPanelProps) {
  const trimmed = description.trim();
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(defaultHidden);
  const clampRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    if (hidden) return;
    const el = clampRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [trimmed, expanded, hidden]);

  if (!trimmed) return null;

  if (hideable && hidden) {
    return (
      <button
        type="button"
        data-testid="description-show"
        aria-label="Show description"
        title="Show description"
        onClick={() => setHidden(false)}
        className="group min-w-[1.25rem] text-sm text-slate-300 hover:text-slate-600 dark:text-serika-sub dark:hover:text-serika-text"
      >
        <span className="group-hover:hidden" aria-hidden>
          —
        </span>
        <span className="hidden group-hover:inline">Show description</span>
      </button>
    );
  }

  const toggleRow = (overflows || hideable) && (
    <div className="mt-1 flex flex-wrap items-center gap-3">
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-500 underline hover:text-slate-800 dark:text-serika-sub dark:hover:text-serika-text"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {hideable && (
        <button
          type="button"
          data-testid="description-hide"
          onClick={() => setHidden(true)}
          className="text-xs text-slate-500 underline hover:text-slate-800 dark:text-serika-sub dark:hover:text-serika-text"
        >
          Hide
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div
        ref={clampRef}
        className={`text-sm leading-snug text-slate-600 dark:text-serika-sub ${
          expanded ? 'whitespace-pre-wrap' : 'line-clamp-1 overflow-hidden'
        }`}
      >
        <span className="text-slate-400 dark:text-serika-sub">Description: </span>
        {linkifyPlainText(trimmed)}
      </div>
      {toggleRow}
    </div>
  );
}
