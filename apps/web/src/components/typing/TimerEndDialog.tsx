import { createPortal } from 'react-dom';

type TimerEndDialogProps = {
  saving: boolean;
  saveError: string | null;
  canSave: boolean;
  onSave: () => void;
  onDontSave: () => void;
};

export function TimerEndDialog({
  saving,
  saveError,
  canSave,
  onSave,
  onDontSave,
}: TimerEndDialogProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-end-title"
        className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="timer-end-title" className="text-lg font-semibold text-slate-900">
          Time&apos;s up
        </h2>
        {canSave ? (
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <p>
              Your countdown has ended. <span className="font-medium text-slate-800">Save session</span>{' '}
              stores only what you typed since your last save in this timed block (or since you
              started typing, if you have not saved yet).
            </p>
            <p>
              Anything you already saved during this countdown is in your course statistics and is
              not saved again. <span className="font-medium text-slate-800">Don&apos;t save</span>{' '}
              discards only this unsaved portion.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <p>
              Your countdown has ended. There is nothing new to save — your last save in this timed
              block is already in your course statistics.
            </p>
            <p>
              Choose <span className="font-medium text-slate-800">Don&apos;t save</span> to continue
              practicing without saving.
            </p>
          </div>
        )}
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDontSave}
            disabled={saving}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Don&apos;t save
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !canSave}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save session'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
