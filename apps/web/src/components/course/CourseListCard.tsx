import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CourseDTO } from '@echotype/shared';
import { toCardPreviewLine } from '../../lib/courseCard';
import { CardOverflowMenu, type OverflowMenuItem } from '../CardOverflowMenu';
import { CourseCardExplicitPractice, CourseStatsPopover, PracticeTag } from '../card/CardPracticeStats';

type CourseListCardProps = {
  course: CourseDTO;
  highlight?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  deleting?: boolean;
  menuItems: OverflowMenuItem[];
  onEdit?: () => void;
  /** Show "In: {collection}" badge (mode list search hits only). */
  showInCollectionLabel?: boolean;
};

export function CourseListCard({
  course,
  highlight,
  bulkMode,
  selected,
  onToggleSelect,
  deleting,
  menuItems,
  onEdit,
  showInCollectionLabel = false,
}: CourseListCardProps) {
  const [popoverCloseToken, setPopoverCloseToken] = useState(0);

  return (
    <li
      className={`relative flex min-h-40 flex-col rounded-md border bg-white p-4 transition-shadow dark:border-serika-border dark:bg-serika-surface ${
        highlight ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {bulkMode && (
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${course.title}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h3 className="line-clamp-1 min-w-0 overflow-hidden font-medium">{course.title}</h3>
              {course.lastPracticeHere && <PracticeTag label="Last practiced here" />}
            </div>
            <CardOverflowMenu
              items={menuItems}
              ariaLabel={`Course actions for ${course.title}`}
              onOpenChange={(open) => {
                if (open) setPopoverCloseToken((n) => n + 1);
              }}
            />
          </div>
          {showInCollectionLabel && course.categoryName && (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-serika-sub">
              Inside collection: {course.categoryName}
            </p>
          )}
        </div>
      </div>
      <p
        className={`mt-1 line-clamp-1 overflow-hidden text-sm leading-5 ${
          course.description?.trim() ? 'text-slate-500 dark:text-serika-sub' : 'text-slate-300 dark:text-serika-sub'
        }`}
      >
        {course.description?.trim() ? toCardPreviewLine(course.description) : '—'}
      </p>
      <p className="mt-1 line-clamp-1 overflow-hidden text-sm leading-5 text-slate-500 dark:text-serika-sub">
        <span className="text-slate-400 dark:text-serika-sub">Content: </span>
        {toCardPreviewLine(course.content)}
      </p>
      <div className="mt-auto space-y-2 pt-3">
        <CourseCardExplicitPractice stats={course.stats} />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/courses/${course.id}/type`}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50]"
          >
            Type this
          </Link>
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
            >
              Edit
            </button>
          )}
          {deleting && <span className="text-xs text-slate-400 dark:text-serika-sub">Deleting…</span>}
          <div className="ml-auto">
            <CourseStatsPopover
              stats={course.stats}
              annotationCount={course.annotations.length}
              popoverCloseToken={popoverCloseToken}
            />
          </div>
        </div>
      </div>
    </li>
  );
}
