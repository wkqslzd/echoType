import { useEffect, useId, useRef, useState } from 'react';
import type { CategoryRollupDTO, CourseStatsDTO } from '@echotype/shared';
import {
  formatAccuracyPercent,
  formatCardDuration,
  formatCardStatsLine,
  formatPracticeDateTime,
} from '@echotype/shared';

export function PracticeTag({ label }: { label: 'Last practiced here' }) {
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-serika-raised dark:text-serika-sub">{label}</span>
  );
}

type StatRow = { label: string; value: string };

type CardStatsPopoverProps = {
  ariaLabel: string;
  rows: StatRow[];
  externalCloseToken?: number;
  /** Stop click/mousedown from reaching a parent link. */
  stopParentClick?: boolean;
};

function usePrefersHover() {
  const [prefersHover, setPrefersHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const apply = () => setPrefersHover(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return prefersHover;
}

function isolateFromParent(
  e: React.MouseEvent,
  stopParentClick: boolean,
) {
  if (!stopParentClick) return;
  e.preventDefault();
  e.stopPropagation();
}

export function CardStatsPopover({
  ariaLabel,
  rows,
  externalCloseToken,
  stopParentClick = false,
}: CardStatsPopoverProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const prefersHover = usePrefersHover();
  const visible = hoverOpen || pinnedOpen;

  useEffect(() => {
    setHoverOpen(false);
    setPinnedOpen(false);
  }, [externalCloseToken]);

  useEffect(() => {
    if (!pinnedOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPinnedOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pinnedOpen]);

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onMouseEnter={prefersHover ? () => setHoverOpen(true) : undefined}
      onMouseLeave={prefersHover ? () => setHoverOpen(false) : undefined}
      onMouseDown={(e) => isolateFromParent(e, stopParentClick)}
      onClick={(e) => isolateFromParent(e, stopParentClick)}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={visible}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setPinnedOpen((v) => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-serika-sub dark:hover:bg-serika-raised dark:hover:text-serika-text"
      >
        <span aria-hidden className="text-base leading-none">
          ⓘ
        </span>
      </button>
      {visible && (
        <div
          id={panelId}
          role="dialog"
          className="absolute bottom-full right-0 z-20 mb-1 w-56 rounded-md border bg-white p-3 text-sm shadow-lg dark:border-serika-border dark:bg-serika-surface"
        >
          {pinnedOpen && (
            <button
              type="button"
              aria-label="Close statistics"
              onClick={(e) => {
                isolateFromParent(e, stopParentClick);
                setPinnedOpen(false);
              }}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-serika-sub dark:hover:bg-serika-raised dark:hover:text-serika-text"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
            </button>
          )}
          <dl className={`space-y-2 ${pinnedOpen ? 'pt-4' : ''}`}>
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-serika-sub">{row.label}</dt>
                <dd className="text-right font-mono text-slate-800 dark:text-serika-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

type CardExplicitStatsProps = {
  totalDurationSec: number;
  totalCompletedPasses: number;
  tag?: React.ReactNode;
  className?: string;
};

export function CardExplicitStats({
  totalDurationSec,
  totalCompletedPasses,
  tag,
  className = '',
}: CardExplicitStatsProps) {
  return (
    <div
      className={`flex min-h-5 min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-serika-sub ${className}`}
    >
      <span>{formatCardStatsLine(totalDurationSec, totalCompletedPasses)}</span>
      {tag}
    </div>
  );
}

function courseStatsRows(stats: CourseStatsDTO, annotationCount: number): StatRow[] {
  return [
    { label: 'Total time', value: formatCardDuration(stats.totalDurationSec) },
    { label: 'Loops', value: String(stats.totalCompletedPasses) },
    { label: 'Sessions', value: String(stats.sessionCount) },
    { label: 'Avg WPM', value: stats.avgWpm != null ? stats.avgWpm.toFixed(1) : '—' },
    { label: 'Avg accuracy', value: formatAccuracyPercent(stats.avgAccuracy) },
    { label: 'Last practiced', value: formatPracticeDateTime(stats.lastPracticedAt) },
    { label: 'Annotations', value: String(annotationCount) },
  ];
}

function collectionRollupRows(rollup: CategoryRollupDTO, courseCount: number): StatRow[] {
  return [
    { label: 'Total time', value: formatCardDuration(rollup.totalDurationSec) },
    { label: 'Loops', value: String(rollup.totalCompletedPasses) },
    { label: 'Last practiced', value: formatPracticeDateTime(rollup.lastPracticedAt) },
    { label: 'Courses', value: String(courseCount) },
  ];
}

type CourseCardExplicitPracticeProps = {
  stats: CourseStatsDTO;
};

export function CourseCardExplicitPractice({ stats }: CourseCardExplicitPracticeProps) {
  return (
    <CardExplicitStats
      totalDurationSec={stats.totalDurationSec}
      totalCompletedPasses={stats.totalCompletedPasses}
    />
  );
}

type CourseStatsPopoverProps = {
  stats: CourseStatsDTO;
  annotationCount: number;
  popoverCloseToken?: number;
};

export function CourseStatsPopover({
  stats,
  annotationCount,
  popoverCloseToken,
}: CourseStatsPopoverProps) {
  return (
    <CardStatsPopover
      ariaLabel="Course practice statistics"
      rows={courseStatsRows(stats, annotationCount)}
      externalCloseToken={popoverCloseToken}
    />
  );
}

type CollectionCardPracticeStatsProps = {
  rollup: CategoryRollupDTO;
  courseCount: number;
  lastPracticeHere: boolean;
  popoverCloseToken?: number;
  /** Stats line and ⓘ on one row (card list, detail header). */
  statsRowInline?: boolean;
  stopParentClick?: boolean;
};

export function CollectionCardPracticeStats({
  rollup,
  courseCount,
  lastPracticeHere,
  popoverCloseToken,
  statsRowInline = false,
  stopParentClick = false,
}: CollectionCardPracticeStatsProps) {
  const popover = (
    <CardStatsPopover
      ariaLabel="Collection practice statistics"
      rows={collectionRollupRows(rollup, courseCount)}
      externalCloseToken={popoverCloseToken}
      stopParentClick={stopParentClick}
    />
  );

  const explicit = (
    <CardExplicitStats
      totalDurationSec={rollup.totalDurationSec}
      totalCompletedPasses={rollup.totalCompletedPasses}
      tag={lastPracticeHere ? <PracticeTag label="Last practiced here" /> : undefined}
      className={statsRowInline ? 'min-w-0 flex-1' : undefined}
    />
  );

  if (statsRowInline) {
    return (
      <div className="flex items-center justify-between gap-2">
        {explicit}
        {popover}
      </div>
    );
  }

  return (
    <>
      {explicit}
      {popover}
    </>
  );
}
