import { memo, useEffect, useMemo, useRef, type Ref } from 'react';
import { NOTE_TEXT_MAX, validateAnnotations } from '@echotype/shared';
import {
  NOTE_FONT_PX,
  NOTE_LINE_PX,
  NOTE_MAX_LINES,
  NOTE_SLOT_PX,
  buildLineData,
  type Band,
  type BandVariant,
  type LineDatum,
  type Note,
} from '../annotated-text/layoutUtils';
import { useTextMeasurement } from '../annotated-text/useTextMeasurement';
import {
  MSG_ABANDON_PICK,
  MSG_ESC_DISCARD,
  STEP3_HELPER_DEFAULT,
  STEP3_HELPER_REVIEW,
} from './annotationMessages';
import {
  buildValidateDraft,
  useAnnotationPickState,
  type EditorAnnotationView,
} from './useAnnotationPickState';
import { computeReviewStatus } from './reviewUtils';
import type { DraftAnnotation } from './useCourseEditor';

export type AnnotatedTextEditorProps = {
  content: string;
  annotations: EditorAnnotationView[];
  onCreate: (draft: Omit<DraftAnnotation, 'localId' | 'anchoredText'> & { anchoredText?: string }) => void;
  onUpdate: (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => void;
  onDelete: (localId: number) => void;
  className?: string;
  disabled?: boolean;
  onPickStateChange?: (s: { active: boolean; hasUnsavedNote: boolean }) => void;
  highlightLocalId?: number | null;
  submitIssueMessages?: string[];
  reviewActive?: boolean;
  /** True when at least one note still needs re-anchoring. */
  reviewPickGate?: boolean;
  yellowLocalIds?: ReadonlySet<number>;
  /** Fired from review panel Reselect; nonce changes each request. */
  reviewCommand?: { type: 'reanchor'; localId: number; nonce: number } | null;
};

function bandClass(
  variant: BandVariant | undefined,
  flashing: boolean,
  highlighted: boolean,
): string {
  if (flashing) return 'rounded-sm bg-red-200 ring-2 ring-red-500 animate-pulse';
  if (highlighted) return 'rounded-sm bg-amber-100 ring-2 ring-red-500';
  if (variant === 'needsReview') return 'rounded-sm bg-amber-100 ring-2 ring-amber-500';
  if (variant === 'match') return 'rounded-sm bg-emerald-100';
  if (variant === 'draft') return 'rounded-sm bg-indigo-100 ring-1 ring-indigo-300';
  return 'rounded-sm bg-amber-100';
}

const EditorBandLayer = memo(function EditorBandLayer({
  bands,
  charHeight,
  conflictFlashIds,
  highlightLocalId,
}: {
  bands: Band[];
  charHeight: number;
  conflictFlashIds: string[];
  highlightLocalId: number | null;
}) {
  if (bands.length === 0) return null;
  return (
    <>
      {bands.map((b, i) => {
        const highlighted = highlightLocalId != null && b.id === String(highlightLocalId);
        return (
          <span
            key={`${b.id}-${i}`}
            data-annotation-id={b.id}
            aria-hidden
            className={`absolute left-0 top-0 z-0 ${bandClass(b.variant, conflictFlashIds.includes(b.id), highlighted)}`}
            style={{ left: b.left, width: b.width, height: charHeight || '1.6em' }}
          />
        );
      })}
    </>
  );
});

const CommittedNoteBox = memo(function CommittedNoteBox({ note }: { note: Note }) {
  return (
    <span
      className="absolute top-0 block cursor-pointer overflow-hidden text-amber-700 hover:underline"
      style={{
        left: note.left,
        width: note.width,
        fontSize: NOTE_FONT_PX,
        lineHeight: `${NOTE_LINE_PX}px`,
        display: '-webkit-box',
        WebkitLineClamp: NOTE_MAX_LINES,
        WebkitBoxOrient: 'vertical',
      }}
      title={note.text}
    >
      {note.text}
    </span>
  );
});

function NoteComposeDock({
  noteText,
  onChange,
  onConfirm,
  onCancel,
  onKeyDown,
  showEditActions,
  onReselect,
  onDelete,
  hint,
}: {
  noteText: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  showEditActions?: boolean;
  onReselect?: () => void;
  onDelete?: () => void;
  hint: string;
}) {
  const len = noteText.length;
  return (
    <div
      className="rounded-md border border-indigo-200 bg-white p-3 shadow-sm"
      data-testid="annotation-compose-dock"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-sm text-slate-600">{hint}</p>
      <textarea
        rows={3}
        className="w-full resize-none rounded border px-3 py-2 font-sans text-sm leading-snug"
        value={noteText}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={NOTE_TEXT_MAX}
        placeholder="Enter annotation…"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${len >= NOTE_TEXT_MAX ? 'text-amber-600' : 'text-slate-400'}`}>
          {len}/{NOTE_TEXT_MAX}
        </span>
        <div className="flex flex-wrap gap-2">
          {showEditActions && onReselect && (
            <button
              type="button"
              onClick={onReselect}
              className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reselect anchors
            </button>
          )}
          {showEditActions && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const EditorLineRow = memo(function EditorLineRow({
  datum,
  chars,
  charHeight,
  conflictFlashIds,
  onCharClick,
  onNoteClick,
  hiddenNoteIds,
  highlightLocalId,
}: {
  datum: LineDatum;
  chars: string[];
  charHeight: number;
  conflictFlashIds: string[];
  onCharClick: (i: number) => void;
  onNoteClick: (localId: number) => void;
  hiddenNoteIds: Set<string>;
  highlightLocalId: number | null;
}) {
  const indices: number[] = [];
  for (let i = datum.start; i <= datum.end; i++) indices.push(i);

  const visibleNotes = datum.notes.filter((n) => !hiddenNoteIds.has(n.id));
  return (
    <div className="mb-2.5 last:mb-0">
      {visibleNotes.length > 0 && (
        <div className="relative" style={{ height: NOTE_SLOT_PX }}>
          {visibleNotes.map((n) => (
            <span
              key={n.id}
              onClick={() => onNoteClick(Number(n.id))}
              onKeyDown={() => {}}
              role="button"
              tabIndex={0}
            >
              <CommittedNoteBox note={n} />
            </span>
          ))}
        </div>
      )}
      {/* minHeight keeps blank lines (only char is '\n', rendered as an empty
          span) one line tall instead of collapsing to a 0px row. */}
      <div className="relative" style={{ whiteSpace: 'pre', minHeight: charHeight || '1.6em' }}>
        <EditorBandLayer
          bands={datum.bands}
          charHeight={charHeight}
          conflictFlashIds={conflictFlashIds}
          highlightLocalId={highlightLocalId}
        />
        <span className="relative z-[1]">
          {indices.map((i) => (
            <span
              key={i}
              data-idx={i}
              role="button"
              tabIndex={0}
              onClick={() => onCharClick(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onCharClick(i);
              }}
              className="cursor-pointer text-slate-700 hover:bg-slate-100"
            >
              {chars[i] === '\n' ? '' : chars[i]}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
});

function composeHint(mode: 'create' | 'edit' | 'reanchorReview' | undefined): string {
  if (mode === 'create') return 'Enter annotation text for the selected range.';
  if (mode === 'reanchorReview') return 'Review the new anchor range and annotation text.';
  return 'Edit annotation text.';
}

export function AnnotatedTextEditor({
  content,
  annotations,
  onCreate,
  onUpdate,
  onDelete,
  className,
  disabled,
  onPickStateChange,
  highlightLocalId = null,
  submitIssueMessages = [],
  reviewActive = false,
  reviewPickGate = false,
  yellowLocalIds,
  reviewCommand = null,
}: AnnotatedTextEditorProps) {
  const { refs, layout, chars } = useTextMeasurement(content);
  const validateDraft = useMemo(
    () => buildValidateDraft(content, annotations, validateAnnotations),
    [content, annotations],
  );

  const isYellowLocalId = useMemo(() => {
    const ids = yellowLocalIds;
    return (localId: number) => ids?.has(localId) ?? false;
  }, [yellowLocalIds]);

  const pick = useAnnotationPickState({
    content,
    annotations,
    validateDraft,
    onCreate,
    onUpdate,
    onDelete,
    disabled,
    onPickStateChange,
    reviewPickGate,
    isYellowLocalId,
  });

  const consumedReviewNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!reviewCommand || reviewCommand.type !== 'reanchor') return;
    if (consumedReviewNonceRef.current === reviewCommand.nonce) return;
    consumedReviewNonceRef.current = reviewCommand.nonce;
    pick.beginReanchorFromIdle(reviewCommand.localId);
  }, [reviewCommand, pick.beginReanchorFromIdle]);

  const layoutAnnotations = useMemo(() => {
    const list = annotations.map((a) => ({
      id: String(a.localId),
      startIndex: a.startIndex,
      endIndex: a.endIndex,
      noteText: a.noteText,
    }));
    if (pick.draftRange) {
      list.push({
        id: 'draft',
        startIndex: pick.draftRange.start,
        endIndex: pick.draftRange.end,
        noteText: '',
      });
    }
    return list;
  }, [annotations, pick.draftRange]);

  const bandVariants = useMemo(() => {
    const m: Record<string, BandVariant> = {};
    for (const a of annotations) {
      const draft = a as DraftAnnotation;
      if (reviewActive && draft.anchoredText !== undefined) {
        m[String(a.localId)] =
          computeReviewStatus(content, draft, true) === 'green' ? 'match' : 'needsReview';
      } else {
        m[String(a.localId)] = 'committed';
      }
    }
    if (pick.draftRange) m.draft = 'draft';
    if (pick.conflictFlashIds.includes('draft')) m.draft = 'conflict';
    for (const id of pick.conflictFlashIds) {
      if (id !== 'draft') m[id] = 'conflict';
    }
    return m;
  }, [annotations, content, reviewActive, pick.draftRange, pick.conflictFlashIds]);

  const hiddenNoteIds = useMemo(() => {
    if (pick.state.kind === 'editingNote' || pick.state.kind === 'reanchorReview') {
      return new Set([String(pick.state.localId)]);
    }
    return new Set<string>();
  }, [pick.state]);

  const lineData = useMemo(
    () =>
      buildLineData(
        layout.lines,
        layoutAnnotations,
        layout.charWidth,
        layout.charHeight,
        bandVariants,
        layout.charEdges,
      ),
    [layout, layoutAnnotations, bandVariants],
  );

  function handleNoteKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (pick.state.kind === 'reanchorReview') {
        if (pick.hasUnsavedNoteText && !window.confirm(MSG_ESC_DISCARD)) return;
        pick.cancelReanchor();
        return;
      }
      const text =
        pick.state.kind === 'enteringNote' || pick.state.kind === 'editingNote'
          ? pick.state.noteText.trim()
          : '';
      if (text && !window.confirm(MSG_ESC_DISCARD)) return;
      pick.cancelNote();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      pick.confirmNote();
    }
  }

  const showComposeDock =
    pick.notePanel &&
    pick.notePanel.mode !== undefined &&
    !pick.isReanchorPicking;

  useEffect(() => {
    if (highlightLocalId == null) return;
    const el = document.querySelector(`[data-annotation-id="${highlightLocalId}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightLocalId]);

  const composeDockProps = showComposeDock
    ? {
        noteText: pick.notePanel!.noteText,
        onChange: pick.setNoteText,
        onConfirm: pick.confirmNote,
        onCancel:
          pick.state.kind === 'reanchorReview' ? pick.cancelReanchor : pick.cancelNote,
        onKeyDown: handleNoteKeyDown,
        showEditActions: pick.notePanel!.mode === 'edit',
        onReselect: pick.notePanel!.mode === 'edit' ? pick.startReanchor : undefined,
        onDelete: pick.notePanel!.mode === 'edit' ? pick.deleteExisting : undefined,
        hint: composeHint(pick.notePanel!.mode),
      }
    : null;

  return (
    <div className={className} data-testid="annotation-editor">
      {submitIssueMessages.length > 0 && (
        <div
          className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          data-testid="annotation-submit-issues"
        >
          <p className="font-medium">Fix these issues before saving:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {submitIssueMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {pick.error && (
        <p
          className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="annotation-editor-error"
        >
          {pick.error}
        </p>
      )}

      <p className="mb-2 text-xs text-slate-500" data-testid="step3-editor-helper">
        {reviewPickGate ? STEP3_HELPER_REVIEW : STEP3_HELPER_DEFAULT}
      </p>

      {(pick.isReanchorPicking || pick.state.kind === 'reanchorReview') && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span>
            {pick.state.kind === 'reanchorReview'
              ? 'Confirm the new anchor range or cancel to keep the original position.'
              : 'Click the start anchor, then the end anchor.'}
          </span>
          <button
            type="button"
            onClick={pick.cancelReanchor}
            className="shrink-0 rounded border border-indigo-300 bg-white px-3 py-1 text-xs text-indigo-800 hover:bg-indigo-100"
          >
            Cancel reselect
          </button>
        </div>
      )}

      {composeDockProps && (
        <div className="mb-4">
          <NoteComposeDock {...composeDockProps} />
        </div>
      )}

      <div
        className="rounded-md border bg-white p-4 font-mono text-base leading-relaxed"
        data-testid="annotated-text"
      >
        <div ref={refs.boxRef as Ref<HTMLDivElement>} style={{ position: 'relative' }}>
          <div
            ref={refs.mirrorRef as Ref<HTMLDivElement>}
            aria-hidden
            data-testid="annotated-mirror"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
            }}
          >
            {chars.map((ch, i) => (
              <span key={i} data-idx={i}>
                {ch}
              </span>
            ))}
          </div>

          <div data-testid="annotated-visible">
            {lineData.map((datum) => (
              <EditorLineRow
                key={`${datum.start}-${datum.end}`}
                datum={datum}
                chars={chars}
                charHeight={layout.charHeight}
                conflictFlashIds={pick.conflictFlashIds}
                onCharClick={pick.handleCharClick}
                onNoteClick={pick.handleBandClick}
                hiddenNoteIds={hiddenNoteIds}
                highlightLocalId={highlightLocalId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Called by the modal before back/close when a pick may be in flight. */
export function confirmAbandonPick(active: boolean, hasUnsavedNote: boolean): boolean {
  if (!active) return true;
  if (hasUnsavedNote) return window.confirm(MSG_ESC_DISCARD);
  return window.confirm(MSG_ABANDON_PICK);
}
