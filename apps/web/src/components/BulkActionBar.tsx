import type { ReactNode, Ref } from 'react';

type BulkActionBarProps = {
  bulkMode: boolean;
  onEnterBulkMode: () => void;
  onCancelBulkMode: () => void;
  selectedCount: number;
  barRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
};

/** Row below search (mode list) or below toolbar (collection detail) for bulk selection. */
export function BulkActionBar({
  bulkMode,
  onEnterBulkMode,
  onCancelBulkMode,
  selectedCount,
  barRef,
  children,
}: BulkActionBarProps) {
  if (!bulkMode) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEnterBulkMode}
          className="rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Bulk actions
        </button>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"
    >
      <button
        type="button"
        onClick={onCancelBulkMode}
        className="rounded border bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
      {selectedCount > 0 && (
        <>
          <span className="text-sm text-slate-600">{selectedCount} selected</span>
          {children}
        </>
      )}
    </div>
  );
}
