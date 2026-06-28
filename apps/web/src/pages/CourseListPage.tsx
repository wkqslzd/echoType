import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryDTO, CourseDTO, CourseListSort, CourseMode } from '@echotype/shared';
import { SEARCH_Q_MAX } from '@echotype/shared';
import { api, isCourseNotFoundError } from '../lib/api';
import { BulkActionBar } from '../components/BulkActionBar';
import { CollectionCard } from '../components/collection/CollectionCard';
import { CollectionEditorModal } from '../components/collection/CollectionEditorModal';
import { CollectionPickerModal } from '../components/collection/CollectionPickerModal';
import { CourseListCard } from '../components/course/CourseListCard';
import { CourseEditorModal } from '../components/editor/CourseEditorModal';
import { readStoredSort, SORT_OPTIONS, writeStoredSort } from '../lib/courseListSort';
import { useImeAwareDebouncedSearch } from '../lib/useImeAwareDebouncedSearch';
import type { OverflowMenuItem } from '../components/CardOverflowMenu';

type EditorTarget =
  | { mode: 'create' }
  | { mode: 'edit'; course: CourseDTO }
  | null;

const HIGHLIGHT_MS = 2000;

const MODE_COPY: Record<
  CourseMode,
  { title: string; empty: string; otherLabel: string; otherPath: string }
> = {
  SHORT: {
    title: 'Short mode',
    empty: 'No collections or courses yet. Create one above.',
    otherLabel: 'Article mode',
    otherPath: '/courses/article',
  },
  ARTICLE: {
    title: 'Article mode',
    empty: 'No collections or courses yet. Create one above.',
    otherLabel: 'Short mode',
    otherPath: '/courses/short',
  },
};

export function CourseListPage({ courseMode }: { courseMode: CourseMode }) {
  const copy = MODE_COPY[courseMode];
  const qc = useQueryClient();
  const search = useImeAwareDebouncedSearch();
  const [sort, setSort] = useState<CourseListSort>(() => readStoredSort(courseMode, 'list'));
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editor, setEditor] = useState<EditorTarget>(null);
  const [highlightCourseId, setHighlightCourseId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collectionEditor, setCollectionEditor] = useState<'create' | { mode: 'edit'; category: CategoryDTO } | null>(
    null,
  );
  const [moveToCollectionOpen, setMoveToCollectionOpen] = useState(false);
  const [pickerAnchorKind, setPickerAnchorKind] = useState<'bulk' | 'menu' | null>(null);
  const [pickerCourseIds, setPickerCourseIds] = useState<string[] | null>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [pendingNewCollectionCourseIds, setPendingNewCollectionCourseIds] = useState<string[] | null>(null);

  const hasQuery = !!search.query;
  const listOpts = { q: search.query || undefined, sort };
  const courseScope = hasQuery ? 'global' : 'null';

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', courseMode, search.query, sort],
    queryFn: () => api.listCategories(courseMode, listOpts),
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', courseMode, courseScope, search.query, sort],
    queryFn: () =>
      api.listCourses(
        courseMode,
        hasQuery ? listOpts : { ...listOpts, categoryId: 'null' },
      ),
  });

  useEffect(() => {
    setSelected(new Set());
  }, [courses, search.query]);

  useEffect(() => {
    if (!highlightCourseId) return;
    const t = setTimeout(() => setHighlightCourseId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightCourseId]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['categories', courseMode] });
    qc.invalidateQueries({ queryKey: ['courses', courseMode] });
  };

  function exitBulkMode() {
    setBulkMode(false);
    setSelected(new Set());
    setMoveToCollectionOpen(false);
    setPickerCourseIds(null);
  }

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => api.deleteCourse(courseId),
    onSuccess: (_data, courseId) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      qc.removeQueries({ queryKey: ['course', courseId] });
      invalidateAll();
      setDeletingId(null);
    },
    onError: (e: unknown) => {
      setDeletingId(null);
      if (isCourseNotFoundError(e)) {
        setActionError('Course not found — it may have already been deleted.');
        invalidateAll();
        return;
      }
      setActionError('Failed to delete course. Please try again.');
    },
  });

  const patchCategory = useMutation({
    mutationFn: ({ courseIds, categoryId }: { courseIds: string[]; categoryId: string | null }) =>
      api.patchCoursesCategory(courseIds, categoryId),
    onSuccess: () => {
      setActionError(null);
      setSelected(new Set());
      setMoveToCollectionOpen(false);
      setPickerCourseIds(null);
      invalidateAll();
    },
    onError: () => setActionError('Failed to update courses. Please try again.'),
  });

  const deleteCollection = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: () => setActionError('Failed to delete collection. Please try again.'),
  });

  const selectedIds = useMemo(() => [...selected], [selected]);

  const selectedInCollectionIds = useMemo(() => {
    if (!courses) return [];
    const idSet = new Set(selectedIds);
    return courses.filter((c) => idSet.has(c.id) && c.categoryId).map((c) => c.id);
  }, [courses, selectedIds]);

  const isLoading = categoriesLoading || coursesLoading;
  const isEmpty = !categories?.length && !courses?.length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(course: CourseDTO) {
    const ok = window.confirm(
      `Delete "${course.title}"? This cannot be undone. All annotations and typing sessions for this course will be removed.`,
    );
    if (!ok) return;
    setActionError(null);
    setDeletingId(course.id);
    deleteMutation.mutate(course.id);
  }

  function handleRemoveOne(course: CourseDTO) {
    const name = course.categoryName ?? 'collection';
    const ok = window.confirm(
      `Remove "${course.title}" from "${name}"? It will return to the main course list.`,
    );
    if (!ok) return;
    patchCategory.mutate({ courseIds: [course.id], categoryId: null });
  }

  function handleRemoveSelected() {
    if (selectedInCollectionIds.length === 0) return;
    const ok = window.confirm(
      `Remove ${selectedInCollectionIds.length} course${selectedInCollectionIds.length === 1 ? '' : 's'} from their collection${selectedInCollectionIds.length === 1 ? '' : 's'}? They will return to the main course list.`,
    );
    if (!ok) return;
    patchCategory.mutate({ courseIds: selectedInCollectionIds, categoryId: null });
  }

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(
      `Delete ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'}? This cannot be undone. All annotations and typing sessions will be removed.`,
    );
    if (!ok) return;
    void Promise.all(selectedIds.map((id) => api.deleteCourse(id)))
      .then(() => {
        setActionError(null);
        setSelected(new Set());
        invalidateAll();
      })
      .catch(() =>
        setActionError('Failed to delete one or more courses. Please refresh and try again.'),
      );
  }

  function handleDeleteCollection(cat: CategoryDTO) {
    const ok = window.confirm(
      `Delete collection "${cat.name}" and all ${cat.courseCount} course${cat.courseCount === 1 ? '' : 's'} inside? This cannot be undone.`,
    );
    if (!ok) return;
    deleteCollection.mutate(cat.id);
  }

  function openMovePicker(
    courseIds: string[],
    options?: { anchorToBulkBar?: boolean; menuTrigger?: HTMLButtonElement },
  ) {
    setPickerCourseIds(courseIds);
    if (options?.anchorToBulkBar) {
      menuAnchorRef.current = null;
      setPickerAnchorKind('bulk');
    } else if (options?.menuTrigger) {
      menuAnchorRef.current = options.menuTrigger;
      setPickerAnchorKind('menu');
    } else {
      menuAnchorRef.current = null;
      setPickerAnchorKind(null);
    }
    setMoveToCollectionOpen(true);
  }

  function assignToCollection(courseIds: string[], target: CategoryDTO) {
    patchCategory.mutate({ courseIds, categoryId: target.id });
  }

  function courseMenuItems(course: CourseDTO): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [
      {
        label: 'Delete',
        variant: 'danger',
        disabled: deletingId === course.id,
        onClick: () => handleDelete(course),
      },
    ];
    if (course.categoryId) {
      items.push(
        {
          label: 'Move to collection…',
          onClick: (ctx) => {
            if (ctx?.trigger) openMovePicker([course.id], { menuTrigger: ctx.trigger });
          },
        },
        {
          label: 'Remove from collection',
          onClick: () => handleRemoveOne(course),
        },
      );
    } else {
      items.push({
        label: 'Add to collection…',
        onClick: (ctx) => {
          if (ctx?.trigger) openMovePicker([course.id], { menuTrigger: ctx.trigger });
        },
      });
    }
    return items;
  }

  function collectionMenuItems(cat: CategoryDTO): OverflowMenuItem[] {
    return [
      {
        label: 'Edit collection',
        onClick: () => setCollectionEditor({ mode: 'edit', category: cat }),
      },
      {
        label: 'Delete collection',
        variant: 'danger',
        onClick: () => handleDeleteCollection(cat),
      },
    ];
  }

  const pickerIds = pickerCourseIds ?? selectedIds;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="mode-page-title">{copy.title}</h2>
            <Link to={copy.otherPath} className="text-sm text-slate-500 hover:text-slate-800">
              Switch to {copy.otherLabel.toLowerCase()} →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCollectionEditor('create')}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New collection
            </button>
            <button
              onClick={() => setEditor({ mode: 'create' })}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New course
            </button>
          </div>
        </div>

        {actionError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {actionError}
          </p>
        )}

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              role="searchbox"
              value={search.draft}
              onChange={(e) => search.setDraft(e.target.value)}
              onCompositionStart={search.onCompositionStart}
              onCompositionEnd={(e) => search.onCompositionEnd(e.currentTarget.value)}
              maxLength={SEARCH_Q_MAX}
              placeholder="Search collections, courses, notes, or description…"
              className="w-full rounded-md border px-3 py-2 pr-9 text-sm"
              aria-label="Search collections and courses"
            />
            {search.showClear && (
              <button
                type="button"
                onClick={search.clear}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                const next = e.target.value as CourseListSort;
                setSort(next);
                writeStoredSort(courseMode, 'list', next);
              }}
              className="rounded-md border px-2 py-2 text-sm"
              aria-label="Sort collections and courses"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : isEmpty ? (
          <p className="text-slate-500">
            {hasQuery ? 'No collections or courses match your search.' : copy.empty}
          </p>
        ) : (
          <div className="space-y-6">
            {!!categories?.length && (
              <div>
                <h3 className="mb-2 text-xl font-semibold">Collections</h3>
                <ul
                  className={`flex flex-col gap-2 ${
                    categories.length > 3 ? 'max-h-[18.5rem] overflow-y-auto pr-1' : ''
                  }`}
                >
                  {categories.map((cat) => (
                    <CollectionCard
                      key={cat.id}
                      category={cat}
                      courseMode={courseMode}
                      menuItems={collectionMenuItems(cat)}
                    />
                  ))}
                </ul>
              </div>
            )}
            {!!courses?.length && (
              <div>
                <h3 className="mb-2 text-xl font-semibold">Courses</h3>
                <BulkActionBar
                  bulkMode={bulkMode}
                  onEnterBulkMode={() => setBulkMode(true)}
                  onCancelBulkMode={exitBulkMode}
                  selectedCount={selectedIds.length}
                  barRef={bulkBarRef}
                >
                  <button
                    type="button"
                    onClick={() => openMovePicker(selectedIds, { anchorToBulkBar: true })}
                    className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Move to collection…
                  </button>
                  {selectedInCollectionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveSelected}
                      className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50"
                    >
                      Remove from collection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="rounded border border-red-200 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete selected
                  </button>
                </BulkActionBar>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {courses.map((c) => (
                    <CourseListCard
                      key={c.id}
                      course={c}
                      highlight={highlightCourseId === c.id}
                      bulkMode={bulkMode}
                      selected={selected.has(c.id)}
                      onToggleSelect={() => toggleSelect(c.id)}
                      deleting={deletingId === c.id}
                      menuItems={courseMenuItems(c)}
                      onEdit={() => setEditor({ mode: 'edit', course: c })}
                      showInCollectionLabel={hasQuery}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {editor && (
        <CourseEditorModal
          key={editor.mode === 'edit' ? `edit-${editor.course.id}` : `create-${courseMode}`}
          mode={editor.mode}
          course={editor.mode === 'edit' ? editor.course : undefined}
          presetCourseMode={courseMode}
          onClose={() => setEditor(null)}
          onSaved={(courseId) => {
            setEditor(null);
            setHighlightCourseId(courseId);
            invalidateAll();
          }}
        />
      )}

      {collectionEditor === 'create' && (
        <CollectionEditorModal
          mode="create"
          courseMode={courseMode}
          onClose={() => {
            setCollectionEditor(null);
            setPendingNewCollectionCourseIds(null);
          }}
          onSaved={(saved) => {
            setCollectionEditor(null);
            if (pendingNewCollectionCourseIds?.length) {
              assignToCollection(pendingNewCollectionCourseIds, saved);
              setPendingNewCollectionCourseIds(null);
            } else {
              invalidateAll();
            }
          }}
        />
      )}

      {collectionEditor && collectionEditor !== 'create' && (
        <CollectionEditorModal
          mode="edit"
          courseMode={courseMode}
          category={collectionEditor.category}
          onClose={() => setCollectionEditor(null)}
          onSaved={() => {
            setCollectionEditor(null);
            invalidateAll();
          }}
        />
      )}

      {moveToCollectionOpen && (
        <CollectionPickerModal
          courseMode={courseMode}
          title="Move to collection"
          anchorRef={
            pickerAnchorKind === 'bulk'
              ? bulkBarRef
              : pickerAnchorKind === 'menu'
                ? menuAnchorRef
                : undefined
          }
          onClose={() => {
            setMoveToCollectionOpen(false);
            setPickerAnchorKind(null);
            menuAnchorRef.current = null;
            setPickerCourseIds(null);
          }}
          onPick={(target) => assignToCollection(pickerIds, target)}
          onNewCollection={() => {
            setPendingNewCollectionCourseIds(pickerIds);
            setMoveToCollectionOpen(false);
            setPickerCourseIds(null);
            setCollectionEditor('create');
          }}
        />
      )}
    </div>
  );
}
