import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CourseMode } from '@echotype/shared';
import { api } from '../../lib/api';

type AddCoursesModalProps = {
  courseMode: CourseMode;
  onClose: () => void;
  onConfirm: (courseIds: string[]) => void;
};

export function AddCoursesModal({ courseMode, onClose, onConfirm }: AddCoursesModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', courseMode, 'null', '', 'createdAt_desc'],
    queryFn: () =>
      api.listCourses(courseMode, { categoryId: 'null', sort: 'createdAt_desc' }),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:border dark:border-serika-border dark:bg-serika-surface">
        <h2 className="text-lg font-semibold dark:text-serika-text">Add courses</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-serika-sub">Select uncategorized courses from the main list.</p>
        <div className="mt-4 max-h-72 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-serika-sub">Loading…</p>
          ) : !courses?.length ? (
            <p className="text-sm text-slate-500 dark:text-serika-sub">No uncategorized courses available.</p>
          ) : (
            <ul className="space-y-1">
              {courses.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-slate-50 dark:hover:bg-serika-raised">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="text-sm dark:text-serika-text">{c.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
          >
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
