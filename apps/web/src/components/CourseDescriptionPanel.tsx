import { useLayoutEffect, useRef, useState } from 'react';
import { linkifyPlainText } from '../lib/linkifyPlainText';

type CourseDescriptionPanelProps = {
  description: string;
};

/** Typing-page description: one line by default; expand only when text overflows. */
export function CourseDescriptionPanel({ description }: CourseDescriptionPanelProps) {
  const trimmed = description.trim();
  const [expanded, setExpanded] = useState(false);
  const clampRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = clampRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [trimmed, expanded]);

  if (!trimmed) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div
        ref={clampRef}
        className={`text-sm leading-snug text-slate-600 ${
          expanded ? 'whitespace-pre-wrap' : 'line-clamp-1 overflow-hidden'
        }`}
      >
        {linkifyPlainText(trimmed)}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-slate-500 underline hover:text-slate-800"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
