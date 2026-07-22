import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryDTO, CourseMode } from '@echotype/shared';
import { api, ApiError } from '../../lib/api';
import { modeCoursesLabel } from '../../lib/modeCoursesLabel';
import { OptionalDescriptionField } from '../OptionalDescriptionField';

type CollectionEditorModalProps = {
  mode: 'create' | 'edit';
  courseMode: CourseMode;
  category?: CategoryDTO;
  onClose: () => void;
  onSaved: (category: CategoryDTO) => void;
};

export function CollectionEditorModal({
  mode,
  courseMode,
  category,
  onClose,
  onSaved,
}: CollectionEditorModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      return mode === 'create'
        ? api.createCategory({ ...payload, mode: courseMode })
        : api.updateCategory(category!.id, payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['categories', courseMode] });
      onSaved(saved);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        const body = e.courseBody;
        if (e.status === 409 && body?.error === 'duplicate_collection_name') {
          setError(
            `A collection named "${name.trim()}" already exists in ${modeCoursesLabel(courseMode)} courses.`,
          );
          return;
        }
        if (e.status === 404) {
          setError('Collection not found — it may have been deleted.');
          return;
        }
        if (e.status === 400) {
          setError('Please check the collection name and try again.');
          return;
        }
      }
      setError('Failed to save collection. Please try again.');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:border dark:border-serika-border dark:bg-serika-surface">
        <h2 className="text-lg font-semibold dark:text-serika-text">
          {mode === 'create' ? 'New collection' : 'Edit collection'}
        </h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-serika-sub">Name</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </label>
          <OptionalDescriptionField
            value={description}
            onChange={setDescription}
            placeholder="What this collection is for, sources, themes…"
            hint="Plain text; URLs become clickable links on the collection page."
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {error}
            </p>
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
            disabled={!name.trim() || save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
