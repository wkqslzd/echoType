import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryDTO, CourseDTO, CourseListSort, CourseMode } from '@echotype/shared';
import { api, isCourseNotFoundError } from '../lib/api';
import { modeListPath } from '../lib/collectionPaths';
import { readStoredSort, SORT_OPTIONS, writeStoredSort } from '../lib/courseListSort';
import { BulkActionBar } from '../components/BulkActionBar';
import { CourseDescriptionPanel } from '../components/CourseDescriptionPanel';
import { CollectionCardPracticeStats, PracticeTag } from '../components/card/CardPracticeStats';
import { AddCoursesModal } from '../components/collection/AddCoursesModal';
import { CollectionEditorModal } from '../components/collection/CollectionEditorModal';
import { CollectionPickerModal } from '../components/collection/CollectionPickerModal';
import { CourseListCard } from '../components/course/CourseListCard';
import { CourseEditorModal } from '../components/editor/CourseEditorModal';
import type { OverflowMenuItem } from '../components/CardOverflowMenu';

const HIGHLIGHT_MS = 2000;

type CollectionDetailPageProps = {
  courseMode: CourseMode;
};

type EditorTarget =
  | { mode: 'create' }
  | { mode: 'edit'; course: CourseDTO }
  | null;

export function CollectionDetailPage({ courseMode }: CollectionDetailPageProps) {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sort, setSort] = useState<CourseListSort>(() => readStoredSort(courseMode, 'detail'));
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editor, setEditor] = useState<EditorTarget>(null);
  const [highlightCourseId, setHighlightCourseId] = useState<string | null>(null);
  const [collectionEditor, setCollectionEditor] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [moveOneCourseId, setMoveOneCourseId] = useState<string | null>(null);
  const [showAddCourses, setShowAddCourses] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const {
    data: category,
    isLoading: categoryLoading,
    error: categoryError,
  } = useQuery({
    queryKey: ['category', collectionId],
    queryFn: () => api.getCategory(collectionId!),
    enabled: !!collectionId,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', courseMode, collectionId, '', sort],
    queryFn: () =>
      api.listCourses(courseMode, { categoryId: collectionId!, sort }),
    enabled: !!collectionId,
  });

  useEffect(() => {
    setSelected(new Set());
  }, [collectionId, courses]);

  useEffect(() => {
    if (!highlightCourseId) return;
    const t = setTimeout(() => setHighlightCourseId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightCourseId]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['categories', courseMode] });
    qc.invalidateQueries({ queryKey: ['courses', courseMode] });
    qc.invalidateQueries({ queryKey: ['category', collectionId] });
  };

  function exitBulkMode() {
    setBulkMode(false);
    setSelected(new Set());
    setBatchMoveOpen(false);
    setMoveOneCourseId(null);
  }

  const patchCategory = useMutation({
    mutationFn: ({ courseIds, categoryId }: { courseIds: string[]; categoryId: string | null }) =>
      api.patchCoursesCategory(courseIds, categoryId),
    onSuccess: () => {
      setActionError(null);
      setSelected(new Set());
      invalidateAll();
    },
    onError: () => setActionError('Failed to update courses. Please try again.'),
  });

  const deleteCourse = useMutation({
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
        invalidateAll();
        return;
      }
      setActionError('Failed to delete course. Please try again.');
    },
  });

  const deleteCollection = useMutation({
    mutationFn: () => api.deleteCategory(collectionId!),
    onSuccess: () => {
      invalidateAll();
      navigate(modeListPath(courseMode));
    },
    onError: () => setActionError('Failed to delete collection. Please try again.'),
  });

  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteCourse(course: CourseDTO) {
    const ok = window.confirm(
      `Delete "${course.title}"? This cannot be undone. All annotations and typing sessions for this course will be removed.`,
    );
    if (!ok) return;
    setDeletingId(course.id);
    deleteCourse.mutate(course.id);
  }

  function handleRemoveOne(course: CourseDTO) {
    if (!category) return;
    const ok = window.confirm(
      `Remove "${course.title}" from "${category.name}"? It will return to the main course list.`,
    );
    if (!ok) return;
    patchCategory.mutate({ courseIds: [course.id], categoryId: null });
  }

  function handleRemoveSelected() {
    if (!category || selectedIds.length === 0) return;
    const ok = window.confirm(
      `Remove ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'} from "${category.name}"? They will return to the main course list.`,
    );
    if (!ok) return;
    patchCategory.mutate({ courseIds: selectedIds, categoryId: null });
  }

  function handleMoveSelected(target: CategoryDTO) {
    if (!category || selectedIds.length === 0) return;
    const ok = window.confirm(
      `Move ${selectedIds.length} course${selectedIds.length === 1 ? '' : 's'} to "${target.name}"?`,
    );
    if (!ok) return;
    setBatchMoveOpen(false);
    patchCategory.mutate({ courseIds: selectedIds, categoryId: target.id });
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
    deleteCollection.mutate();
  }

  function buildCourseMenu(course: CourseDTO): OverflowMenuItem[] {
    return [
      {
        label: 'Delete',
        variant: 'danger',
        disabled: deletingId === course.id,
        onClick: () => handleDeleteCourse(course),
      },
      {
        label: 'Move to collection…',
        onClick: (ctx) => {
          menuAnchorRef.current = ctx?.trigger ?? null;
          setMoveOneCourseId(course.id);
        },
      },
      {
        label: 'Remove from collection',
        onClick: () => handleRemoveOne(course),
      },
    ];
  }

  if (categoryLoading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (categoryError || !category || category.mode !== courseMode) {
    return (
      <div className="space-y-3">
        <p className="text-slate-600">Collection not found.</p>
        <Link to={modeListPath(courseMode)} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to {courseMode === 'SHORT' ? 'short' : 'article'} courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={modeListPath(courseMode)} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{category.name}</h1>
              {category.lastPracticeHere && <PracticeTag label="Last practiced here" />}
            </div>
            <div className="mt-2 max-w-md">
              <CollectionCardPracticeStats
                rollup={category.rollup}
                courseCount={category.courseCount}
                lastPracticeHere={false}
                statsRowInline
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCollectionEditor(true)}
              className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Edit collection
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCollection(category)}
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Delete collection
            </button>
          </div>
        </div>
        {category.description?.trim() && (
          <div className="mt-3">
            <CourseDescriptionPanel description={category.description} />
          </div>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditor({ mode: 'create' })}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New course
          </button>
          <button
            type="button"
            onClick={() => setShowAddCourses(true)}
            className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Add courses…
          </button>
          {!bulkMode && (
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Bulk actions
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
              writeStoredSort(courseMode, 'detail', next);
            }}
            className="rounded-md border px-2 py-2 text-sm"
            aria-label="Sort courses"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {bulkMode && (
        <BulkActionBar
          bulkMode
          onEnterBulkMode={() => setBulkMode(true)}
          onCancelBulkMode={exitBulkMode}
          selectedCount={selectedIds.length}
          barRef={bulkBarRef}
        >
          <button
            type="button"
            onClick={() => setBatchMoveOpen(true)}
            className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50"
          >
            Move to collection…
          </button>
          <button
            type="button"
            onClick={handleRemoveSelected}
            className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50"
          >
            Remove from collection
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="rounded border border-red-200 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            Delete selected
          </button>
        </BulkActionBar>
      )}

      {coursesLoading ? (
        <p className="text-slate-500">Loading courses…</p>
      ) : !courses?.length ? (
        <p className="text-slate-500">No courses in this collection yet.</p>
      ) : (
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
              menuItems={buildCourseMenu(c)}
              onEdit={() => setEditor({ mode: 'edit', course: c })}
            />
          ))}
        </ul>
      )}

      {editor && (
        <CourseEditorModal
          key={editor.mode === 'edit' ? `edit-${editor.course.id}` : `create-${collectionId}`}
          mode={editor.mode}
          course={editor.mode === 'edit' ? editor.course : undefined}
          presetCourseMode={courseMode}
          presetCategoryId={editor.mode === 'create' ? collectionId : undefined}
          onClose={() => setEditor(null)}
          onSaved={(courseId) => {
            setEditor(null);
            setHighlightCourseId(courseId);
            invalidateAll();
          }}
        />
      )}

      {collectionEditor && (
        <CollectionEditorModal
          mode="edit"
          courseMode={courseMode}
          category={category}
          onClose={() => setCollectionEditor(false)}
          onSaved={() => {
            setCollectionEditor(false);
            invalidateAll();
          }}
        />
      )}

      {showAddCourses && (
        <AddCoursesModal
          courseMode={courseMode}
          onClose={() => setShowAddCourses(false)}
          onConfirm={(courseIds) => {
            setShowAddCourses(false);
            patchCategory.mutate({ courseIds, categoryId: collectionId! });
          }}
        />
      )}

      {batchMoveOpen && (
        <CollectionPickerModal
          courseMode={courseMode}
          title="Move to collection"
          excludeCategoryId={collectionId}
          anchorRef={bulkBarRef}
          onClose={() => setBatchMoveOpen(false)}
          onPick={(target) => handleMoveSelected(target)}
        />
      )}

      {moveOneCourseId && (
        <CollectionPickerModal
          courseMode={courseMode}
          title="Move to collection"
          excludeCategoryId={collectionId}
          anchorRef={menuAnchorRef}
          onClose={() => {
            setMoveOneCourseId(null);
            menuAnchorRef.current = null;
          }}
          onPick={(target) => {
            patchCategory.mutate({ courseIds: [moveOneCourseId], categoryId: target.id });
            setMoveOneCourseId(null);
            menuAnchorRef.current = null;
          }}
        />
      )}
    </div>
  );
}
