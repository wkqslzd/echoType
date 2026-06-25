import { CourseListSort, type CourseMode } from '@echotype/shared';

export const DEFAULT_SORT: CourseListSort = 'createdAt_desc';

export const SORT_OPTIONS: { value: CourseListSort; label: string }[] = [
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'createdAt_asc', label: 'Oldest first' },
  { value: 'updatedAt_desc', label: 'Recently updated' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'loopCount_desc', label: 'Most loops' },
  { value: 'totalDuration_desc', label: 'Most practice time' },
  { value: 'lastPracticed_desc', label: 'Recently practiced' },
];

/** Mode list page (collections + uncategorized courses). */
const STORAGE_KEY_LIST = 'echotype.courseListSort.list.v1';
/** Collection detail page (member courses only). */
const STORAGE_KEY_DETAIL = 'echotype.courseListSort.detail.v1';

export type CourseListSortScope = 'list' | 'detail';

function storageKey(scope: CourseListSortScope): string {
  return scope === 'list' ? STORAGE_KEY_LIST : STORAGE_KEY_DETAIL;
}

function parseStore(raw: string | null): Partial<Record<CourseMode, CourseListSort>> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    if (typeof obj !== 'object' || obj === null) return {};
    return obj as Partial<Record<CourseMode, CourseListSort>>;
  } catch {
    return {};
  }
}

function isValidSort(value: unknown): value is CourseListSort {
  return CourseListSort.safeParse(value).success;
}

export function readStoredSort(mode: CourseMode, scope: CourseListSortScope): CourseListSort {
  try {
    const value = parseStore(localStorage.getItem(storageKey(scope)))[mode];
    if (value != null && isValidSort(value)) return value;
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
  return DEFAULT_SORT;
}

export function writeStoredSort(
  mode: CourseMode,
  scope: CourseListSortScope,
  sort: CourseListSort,
): void {
  try {
    const store = parseStore(localStorage.getItem(storageKey(scope)));
    store[mode] = sort;
    localStorage.setItem(storageKey(scope), JSON.stringify(store));
  } catch {
    // ignore
  }
}
