import { Link } from 'react-router-dom';
import type { CategoryDTO, CourseMode } from '@echotype/shared';
import { formatCardStatsLine } from '@echotype/shared';
import { collectionDetailPath } from '../../lib/collectionPaths';
import { toCardPreviewLine } from '../../lib/courseCard';
import { CardOverflowMenu, type OverflowMenuItem } from '../CardOverflowMenu';
import { PracticeTag } from '../card/CardPracticeStats';

type CollectionCardProps = {
  category: CategoryDTO;
  courseMode: CourseMode;
  menuItems: OverflowMenuItem[];
};

export function CollectionCard({ category, courseMode, menuItems }: CollectionCardProps) {
  const detailPath = collectionDetailPath(courseMode, category.id);
  const statsLine = formatCardStatsLine(
    category.rollup.totalDurationSec,
    category.rollup.totalCompletedPasses,
  );

  return (
    <li className="rounded-md border bg-white transition-shadow hover:shadow-sm dark:border-serika-border dark:bg-serika-surface">
      <div className="flex items-start gap-3 p-4">
        <Link to={detailPath} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-1 min-w-0 flex-1 overflow-hidden font-medium">{category.name}</h3>
            {category.lastPracticeHere && <PracticeTag label="Last practiced here" />}
          </div>
          <p
            className={`mt-1 line-clamp-1 overflow-hidden text-sm leading-5 ${
              category.description?.trim() ? 'text-slate-500 dark:text-serika-sub' : 'text-slate-300 dark:text-serika-sub'
            }`}
          >
            {category.description?.trim() ? toCardPreviewLine(category.description) : '—'}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-serika-sub">
            {category.courseCount} course{category.courseCount === 1 ? '' : 's'} · {statsLine}
          </p>
        </Link>
        <CardOverflowMenu
          items={menuItems}
          ariaLabel={`Collection actions for ${category.name}`}
        />
      </div>
    </li>
  );
}
