import { createPortal } from 'react-dom';

type TypingLeaveDialogProps = {
  saving: boolean;
  saveError: string | null;
  onStay: () => void;
  onLeave: () => void;
  onSaveAndLeave: () => void;
};

export function TypingLeaveDialog({
  saving,
  saveError,
  onStay,
  onLeave,
  onSaveAndLeave,
}: TypingLeaveDialogProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onStay();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="typing-leave-title"
        className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="typing-leave-title" className="text-lg font-semibold text-slate-900">
          Leave typing page?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You have unsaved typing progress. Course statistics update only when you save a session.
        </p>
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            disabled={saving}
            className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            disabled={saving}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Leave without saving
          </button>
          <button
            type="button"
            onClick={onSaveAndLeave}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save and leave'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
