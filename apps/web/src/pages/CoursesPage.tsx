import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ARTICLE_MAX,
  ARTICLE_MIN,
  CourseMode,
  SHORT_MAX,
  SHORT_MIN,
} from '@echotype/shared';
import { api } from '../lib/api';

export function CoursesPage() {
  const qc = useQueryClient();
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: api.listCourses,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<CourseMode>('SHORT');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: api.createCourse,
    onSuccess: () => {
      setTitle('');
      setContent('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const len = content.length;
  const lengthOk =
    mode === 'SHORT' ? len >= SHORT_MIN && len <= SHORT_MAX : len >= ARTICLE_MIN && len <= ARTICLE_MAX;
  const canSubmit = title.trim() && content && lengthOk && !createMutation.isPending;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Your courses</h2>
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !courses?.length ? (
          <p className="text-slate-500">No courses yet. Create one below.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id} className="rounded-md border bg-white p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-medium">{c.title}</h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {c.mode}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500">{c.content}</p>
                <Link
                  to={`/courses/${c.id}/type`}
                  className="mt-3 inline-block rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800"
                >
                  Type this
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border bg-white p-4">
        <h2 className="mb-3 text-xl font-semibold">Create a new course</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-600">Title</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Mode</span>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as CourseMode)}
            >
              <option value="SHORT">
                SHORT ({SHORT_MIN}–{SHORT_MAX} chars)
              </option>
              <option value="ARTICLE">
                ARTICLE ({ARTICLE_MIN}–{ARTICLE_MAX} chars)
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Content ({len} chars)</span>
            <textarea
              className="mt-1 h-40 w-full rounded border px-3 py-2 font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          {!lengthOk && content && (
            <p className="text-sm text-amber-600">Length does not match {mode} mode bounds.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={!canSubmit}
            onClick={() => createMutation.mutate({ title: title.trim(), content, mode })}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {createMutation.isPending ? 'Saving…' : 'Create course'}
          </button>
        </div>
      </section>
    </div>
  );
}
