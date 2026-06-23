import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CourseDTO, CourseListSort, CourseMode } from '@echotype/shared';
import { SEARCH_Q_MAX } from '@echotype/shared';
import { api, ApiError, isCourseNotFoundError } from '../lib/api';
import { CourseEditorModal } from '../components/editor/CourseEditorModal';
import { toCardPreviewLine } from '../lib/courseCard';
import { useImeAwareDebouncedSearch } from '../lib/useImeAwareDebouncedSearch';

type EditorTarget =
  | { mode: 'create' }
  | { mode: 'edit'; course: CourseDTO }
  | null;

const HIGHLIGHT_MS = 2000;

const DEFAULT_SORT: CourseListSort = 'createdAt_desc';

const SORT_OPTIONS: { value: CourseListSort; label: string }[] = [
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'createdAt_asc', label: 'Oldest first' },
  { value: 'updatedAt_desc', label: 'Recently updated' },
  { value: 'title_asc', label: 'Title A–Z' },
];

const MODE_COPY: Record<
  CourseMode,
  { title: string; empty: string; otherLabel: string; otherPath: string }
> = {
  SHORT: {
    title: 'Short courses',
    empty: 'No short courses yet. Create one above.',
    otherLabel: 'Article courses',
    otherPath: '/courses/article',
  },
  ARTICLE: {
    title: 'Article courses',
    empty: 'No article courses yet. Create one above.',
    otherLabel: 'Short courses',
    otherPath: '/courses/short',
  },
};

export function CourseListPage({ courseMode }: { courseMode: CourseMode }) {
  const copy = MODE_COPY[courseMode];
  const qc = useQueryClient();
  const search = useImeAwareDebouncedSearch();
  const [sort, setSort] = useState<CourseListSort>(DEFAULT_SORT);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', courseMode, search.query, sort],
    queryFn: () =>
      api.listCourses(courseMode, {
        q: search.query || undefined,
        sort,
      }),
  });

  const [editor, setEditor] = useState<EditorTarget>(null);
  const [highlightCourseId, setHighlightCourseId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => api.deleteCourse(courseId),
    onSuccess: (_data, courseId) => {
      setDeleteError(null);
      qc.invalidateQueries({ queryKey: ['courses', courseMode] });
      qc.removeQueries({ queryKey: ['course', courseId] });
      setDeletingId(null);
    },
    onError: (e: unknown) => {
      setDeletingId(null);
      if (isCourseNotFoundError(e)) {
        setDeleteError('Course not found — it may have already been deleted.');
        qc.invalidateQueries({ queryKey: ['courses', courseMode] });
        return;
      }
      setDeleteError('Failed to delete course. Please try again.');
    },
  });

  function handleDelete(course: CourseDTO) {
    const ok = window.confirm(
      `Delete "${course.title}"? This cannot be undone. All annotations and typing sessions for this course will be removed.`,
    );
    if (!ok) return;
    setDeleteError(null);
    setDeletingId(course.id);
    deleteMutation.mutate(course.id);
  }

  useEffect(() => {
    if (!highlightCourseId) return;
    const t = setTimeout(() => setHighlightCourseId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightCourseId]);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{copy.title}</h2>
            <Link to={copy.otherPath} className="text-sm text-slate-500 hover:text-slate-800">
              Switch to {copy.otherLabel.toLowerCase()} →
            </Link>
          </div>
          <button
            onClick={() => setEditor({ mode: 'create' })}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New course
          </button>
        </div>

        {deleteError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {deleteError}
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
              placeholder="Search title, content, notes, or description…"
              className="w-full rounded-md border px-3 py-2 pr-9 text-sm"
              aria-label="Search courses"
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
              onChange={(e) => setSort(e.target.value as CourseListSort)}
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

        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !courses?.length ? (
          <p className="text-slate-500">
            {search.query ? 'No courses match your search.' : copy.empty}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className={`flex min-h-40 flex-col rounded-md border bg-white p-4 transition-shadow ${
                  highlightCourseId === c.id ? 'ring-2 ring-emerald-400' : ''
                }`}
              >
                <h3 className="line-clamp-1 overflow-hidden font-medium">{c.title}</h3>
                <p
                  className={`mt-1 line-clamp-1 overflow-hidden text-sm leading-5 ${
                    c.description?.trim() ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {c.description?.trim() ? toCardPreviewLine(c.description) : '—'}
                </p>
                <div className="h-5 shrink-0" aria-hidden />
                <p className="line-clamp-1 overflow-hidden text-sm leading-5 text-slate-500">
                  <span className="text-slate-400">Content: </span>
                  {toCardPreviewLine(c.content)}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <Link
                    to={`/courses/${c.id}/type`}
                    className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800"
                  >
                    Type this
                  </Link>
                  <button
                    onClick={() => setEditor({ mode: 'edit', course: c })}
                    className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    className="rounded border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === c.id ? 'Deleting…' : 'Delete'}
                  </button>
                  {c.annotations.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {c.annotations.length} annotation{c.annotations.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
          }}
        />
      )}
    </div>
  );
}
