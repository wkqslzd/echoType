import { useCallback, useEffect, useMemo, useState } from 'react';
import { expandRangeToGraphemeBoundaries } from '@echotype/shared';
import {
  MSG_ANCHOR_END_WHITESPACE,
  MSG_ANCHOR_START_WHITESPACE,
  MSG_ILL_FORMED_RANGE,
  MSG_NOTE_EMPTY,
  MSG_ORDER_INVALID,
  MSG_REVIEW_NEW_ANNOTATION,
  MSG_SERIAL_BLOCK,
  formatOverlapMessage,
} from './annotationMessages';
import type { DraftAnnotation } from './useCourseEditor';

export type EditorAnnotationView = {
  localId: number;
  startIndex: number;
  endIndex: number;
  noteText: string;
};

type PickState =
  | { kind: 'idle' }
  | { kind: 'pickingEnd'; start: number }
  | { kind: 'enteringNote'; start: number; end: number; noteText: string }
  | { kind: 'editingNote'; localId: number; noteText: string; originalNoteText: string }
  | {
      kind: 'reanchor';
      localId: number;
      phase: 'start' | 'end';
      tempStart?: number;
      /** idle = started from review banner; edit = started from note compose dock. */
      origin: 'idle' | 'edit';
    }
  | {
      kind: 'reanchorReview';
      localId: number;
      pendingStart: number;
      pendingEnd: number;
      noteText: string;
      originalNoteText: string;
      origin: 'idle' | 'edit';
    };

export type ValidateDraftFn = (
  start: number,
  end: number,
  excludeLocalId?: number,
) => { message: string; conflictLocalId?: number } | null;

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

function findOverlapConflict(
  annotations: EditorAnnotationView[],
  start: number,
  end: number,
  excludeLocalId?: number,
): EditorAnnotationView | null {
  for (const a of annotations) {
    if (a.localId === excludeLocalId) continue;
    if (rangesOverlap(start, end, a.startIndex, a.endIndex)) return a;
  }
  return null;
}

function whitespaceError(content: string, index: number, isEnd: boolean): string | null {
  if (/\s/.test(content.charAt(index))) {
    return isEnd ? MSG_ANCHOR_END_WHITESPACE : MSG_ANCHOR_START_WHITESPACE;
  }
  return null;
}

export function useAnnotationPickState({
  content,
  annotations,
  validateDraft,
  onCreate,
  onUpdate,
  onDelete,
  disabled,
  onPickStateChange,
  reviewPickGate = false,
  isYellowLocalId = () => false,
}: {
  content: string;
  annotations: EditorAnnotationView[];
  validateDraft: ValidateDraftFn;
  onCreate: (draft: Omit<DraftAnnotation, 'localId' | 'anchoredText'> & { anchoredText?: string }) => void;
  onUpdate: (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => void;
  onDelete: (localId: number) => void;
  disabled?: boolean;
  onPickStateChange?: (s: { active: boolean; hasUnsavedNote: boolean }) => void;
  /** True when review is active and at least one note still needs re-anchoring. */
  reviewPickGate?: boolean;
  isYellowLocalId?: (localId: number) => boolean;
}) {
  const [state, setState] = useState<PickState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [conflictFlashIds, setConflictFlashIds] = useState<string[]>([]);

  const isPickActive = state.kind !== 'idle';

  const flashConflict = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setConflictFlashIds(ids);
    const t = setTimeout(() => setConflictFlashIds([]), 1500);
    return () => clearTimeout(t);
  }, []);

  const clearEphemeral = useCallback(() => {
    setState({ kind: 'idle' });
    setError(null);
  }, []);

  const enterReanchor = useCallback(
    (localId: number) => {
      if (disabled) return;
      const ann = annotations.find((a) => a.localId === localId);
      if (!ann) return;

      if (state.kind === 'idle') {
        setState({ kind: 'reanchor', localId, phase: 'start', origin: 'idle' });
        setError(null);
        return;
      }
      if (state.kind === 'editingNote' && state.localId === localId) {
        setState({ kind: 'reanchor', localId, phase: 'start', origin: 'edit' });
        setError(null);
        return;
      }
      if (
        (state.kind === 'reanchor' || state.kind === 'reanchorReview') &&
        state.localId === localId
      ) {
        setState({ kind: 'reanchor', localId, phase: 'start', origin: state.origin });
        setError(null);
        return;
      }
      setError(MSG_SERIAL_BLOCK);
    },
    [disabled, state, annotations],
  );

  const tryRange = useCallback(
    (
      rawStart: number,
      rawEnd: number,
      excludeLocalId: number | undefined,
      onValid: (start: number, end: number) => void,
    ) => {
      let start = Math.min(rawStart, rawEnd);
      let end = Math.max(rawStart, rawEnd);
      ({ startIndex: start, endIndex: end } = expandRangeToGraphemeBoundaries(content, start, end));
      const startErr = whitespaceError(content, start, false);
      if (startErr) {
        setError(startErr);
        return;
      }
      const endErr = whitespaceError(content, end, true);
      if (endErr) {
        setError(endErr);
        return;
      }
      const issue = validateDraft(start, end, excludeLocalId);
      if (issue) {
        setError(issue.message);
        const ids: string[] = [];
        if (issue.conflictLocalId != null) ids.push(String(issue.conflictLocalId));
        ids.push('draft');
        flashConflict(ids);
        return;
      }
      setError(null);
      onValid(start, end);
    },
    [content, validateDraft, flashConflict],
  );

  const handleCharClick = useCallback(
    (index: number) => {
      if (disabled) return;

      if (
        state.kind === 'enteringNote' ||
        state.kind === 'editingNote' ||
        state.kind === 'reanchorReview'
      ) {
        setError(MSG_SERIAL_BLOCK);
        return;
      }

      if (state.kind === 'reanchor') {
        if (state.phase === 'start') {
          const err = whitespaceError(content, index, false);
          if (err) {
            setError(err);
            return;
          }
          setState({
            kind: 'reanchor',
            localId: state.localId,
            phase: 'end',
            tempStart: index,
            origin: state.origin,
          });
          setError(null);
          return;
        }
        const tempStart = state.tempStart!;
        if (index === tempStart) {
          if (state.origin === 'idle') {
            clearEphemeral();
          } else {
            setState({
              kind: 'editingNote',
              localId: state.localId,
              noteText: annotations.find((a) => a.localId === state.localId)?.noteText ?? '',
              originalNoteText: annotations.find((a) => a.localId === state.localId)?.noteText ?? '',
            });
          }
          setError(null);
          return;
        }
        tryRange(tempStart, index, state.localId, (start, end) => {
          const ann = annotations.find((a) => a.localId === state.localId);
          setState({
            kind: 'reanchorReview',
            localId: state.localId,
            pendingStart: start,
            pendingEnd: end,
            noteText: ann?.noteText ?? '',
            originalNoteText: ann?.noteText ?? '',
            origin: state.origin,
          });
        });
        return;
      }

      if (state.kind === 'pickingEnd') {
        if (index === state.start) {
          clearEphemeral();
          return;
        }
        const conflict = annotations.find(
          (a) => a.startIndex <= index && a.endIndex >= index,
        );
        if (conflict) {
          setError(MSG_SERIAL_BLOCK);
          return;
        }
        tryRange(state.start, index, undefined, (start, end) => {
          setState({ kind: 'enteringNote', start, end, noteText: '' });
        });
        return;
      }

      // idle: edit an existing band or start a new pick
      const containing = annotations.find((a) => a.startIndex <= index && a.endIndex >= index);
      if (containing) {
        if (reviewPickGate && isYellowLocalId(containing.localId)) {
          enterReanchor(containing.localId);
          return;
        }
        setState({
          kind: 'editingNote',
          localId: containing.localId,
          noteText: containing.noteText,
          originalNoteText: containing.noteText,
        });
        setError(null);
        return;
      }
      if (reviewPickGate) {
        setError(MSG_REVIEW_NEW_ANNOTATION);
        return;
      }
      const err = whitespaceError(content, index, false);
      if (err) {
        setError(err);
        return;
      }
      setState({ kind: 'pickingEnd', start: index });
      setError(null);
    },
    [disabled, state, content, annotations, tryRange, clearEphemeral, reviewPickGate, isYellowLocalId, enterReanchor],
  );

  const handleBandClick = useCallback(
    (localId: number) => {
      if (disabled) return;
      if (reviewPickGate && isYellowLocalId(localId)) {
        enterReanchor(localId);
        return;
      }
      if (state.kind !== 'idle') {
        setError(MSG_SERIAL_BLOCK);
        return;
      }
      const ann = annotations.find((a) => a.localId === localId);
      if (!ann) return;
      setState({
        kind: 'editingNote',
        localId,
        noteText: ann.noteText,
        originalNoteText: ann.noteText,
      });
      setError(null);
    },
    [disabled, state.kind, annotations, reviewPickGate, isYellowLocalId, enterReanchor],
  );

  const setNoteText = useCallback((text: string) => {
    setState((prev) => {
      if (prev.kind === 'enteringNote') return { ...prev, noteText: text };
      if (prev.kind === 'editingNote') return { ...prev, noteText: text };
      if (prev.kind === 'reanchorReview') return { ...prev, noteText: text };
      return prev;
    });
    setError(null);
  }, []);

  const confirmNote = useCallback(() => {
    if (state.kind === 'enteringNote') {
      const text = state.noteText.trim();
      if (!text) {
        setError(MSG_NOTE_EMPTY);
        return;
      }
      onCreate({ startIndex: state.start, endIndex: state.end, noteText: text });
      clearEphemeral();
      return;
    }
    if (state.kind === 'editingNote') {
      const text = state.noteText.trim();
      if (!text) {
        setError(MSG_NOTE_EMPTY);
        return;
      }
      onUpdate(state.localId, { noteText: text });
      clearEphemeral();
      return;
    }
    if (state.kind === 'reanchorReview') {
      const text = state.noteText.trim();
      if (!text) {
        setError(MSG_NOTE_EMPTY);
        return;
      }
      onUpdate(state.localId, {
        startIndex: state.pendingStart,
        endIndex: state.pendingEnd,
        noteText: text,
      });
      clearEphemeral();
    }
  }, [state, onCreate, onUpdate, clearEphemeral]);

  const cancelNote = useCallback(() => {
    clearEphemeral();
  }, [clearEphemeral]);

  const startReanchor = useCallback(() => {
    if (state.kind !== 'editingNote') return;
    setState({ kind: 'reanchor', localId: state.localId, phase: 'start', origin: 'edit' });
    setError(null);
  }, [state]);

  const beginReanchorFromIdle = enterReanchor;

  const cancelReanchor = useCallback(() => {
    if (state.kind !== 'reanchor' && state.kind !== 'reanchorReview') return;
    if (state.origin === 'idle') {
      clearEphemeral();
      return;
    }
    const ann = annotations.find((a) => a.localId === state.localId);
    if (!ann) {
      clearEphemeral();
      return;
    }
    // Parent state was never updated during reanchor picking; return to edit mode
    // at the original anchors.
    setState({
      kind: 'editingNote',
      localId: state.localId,
      noteText: ann.noteText,
      originalNoteText: ann.noteText,
    });
    setError(null);
  }, [state, annotations, clearEphemeral]);

  const deleteExisting = useCallback(() => {
    if (state.kind !== 'editingNote') return;
    onDelete(state.localId);
    clearEphemeral();
  }, [state, onDelete, clearEphemeral]);

  const draftRange = useMemo(() => {
    if (state.kind === 'pickingEnd') return { start: state.start, end: state.start };
    if (state.kind === 'enteringNote') return { start: state.start, end: state.end };
    if (state.kind === 'reanchor' && state.phase === 'end' && state.tempStart != null) {
      return { start: state.tempStart, end: state.tempStart };
    }
    if (state.kind === 'reanchorReview') {
      return { start: state.pendingStart, end: state.pendingEnd };
    }
    return null;
  }, [state]);

  const isReanchorPicking = state.kind === 'reanchor';

  const notePanel = useMemo(() => {
    if (state.kind === 'enteringNote') {
      return { start: state.start, end: state.end, noteText: state.noteText, mode: 'create' as const };
    }
    if (state.kind === 'reanchorReview') {
      return {
        start: state.pendingStart,
        end: state.pendingEnd,
        noteText: state.noteText,
        mode: 'reanchorReview' as const,
      };
    }
    if (state.kind === 'editingNote') {
      const ann = annotations.find((a) => a.localId === state.localId);
      if (!ann) return null;
      return {
        start: ann.startIndex,
        end: ann.endIndex,
        noteText: state.noteText,
        mode: 'edit' as const,
      };
    }
    return null;
  }, [state, annotations]);

  const hasUnsavedNoteText = useMemo(() => {
    if (state.kind === 'enteringNote') return state.noteText.trim().length > 0;
    if (state.kind === 'editingNote') return state.noteText.trim() !== state.originalNoteText.trim();
    if (state.kind === 'reanchorReview') {
      const ann = annotations.find((a) => a.localId === state.localId);
      if (!ann) return true;
      return (
        state.pendingStart !== ann.startIndex ||
        state.pendingEnd !== ann.endIndex ||
        state.noteText.trim() !== state.originalNoteText.trim()
      );
    }
    return false;
  }, [state, annotations]);

  useEffect(() => {
    onPickStateChange?.({ active: isPickActive, hasUnsavedNote: hasUnsavedNoteText });
  }, [isPickActive, hasUnsavedNoteText, onPickStateChange]);

  return {
    state,
    error,
    setError,
    conflictFlashIds,
    isPickActive,
    draftRange,
    notePanel,
    isReanchorPicking,
    hasUnsavedNoteText,
    handleCharClick,
    handleBandClick,
    setNoteText,
    confirmNote,
    cancelNote,
    startReanchor,
    beginReanchorFromIdle,
    cancelReanchor,
    deleteExisting,
    clearEphemeral,
    tryRange,
    findOverlapConflict: (start: number, end: number, exclude?: number) =>
      findOverlapConflict(annotations, start, end, exclude),
  };
}

/** Build validateDraft result with user-facing messages and conflict id for overlap flashes. */
export function buildValidateDraft(
  content: string,
  annotations: EditorAnnotationView[],
  validateAnnotations: typeof import('@echotype/shared').validateAnnotations,
): ValidateDraftFn {
  return (startIndex, endIndex, excludeLocalId) => {
    const others = annotations
      .filter((a) => a.localId !== excludeLocalId)
      .map((a) => ({ startIndex: a.startIndex, endIndex: a.endIndex, noteText: a.noteText }));
    const candidate = { startIndex, endIndex, noteText: 'x' };
    const issues = validateAnnotations(content, [...others, candidate]);
    const candidateIdx = others.length;
    const mine = issues.find((it) => it.index === candidateIdx);
    if (!mine) return null;

    switch (mine.code) {
      case 'anchor_start_whitespace':
        return { message: MSG_ANCHOR_START_WHITESPACE };
      case 'anchor_end_whitespace':
        return { message: MSG_ANCHOR_END_WHITESPACE };
      case 'overlap': {
        const conflict = findOverlapConflict(annotations, startIndex, endIndex, excludeLocalId);
        const idx = conflict
          ? annotations.findIndex((a) => a.localId === conflict.localId) + 1
          : 1;
        return {
          message: formatOverlapMessage(conflict?.noteText ?? '', idx),
          conflictLocalId: conflict?.localId,
        };
      }
      case 'order':
        return { message: MSG_ORDER_INVALID };
      case 'ill_formed_range':
        return { message: MSG_ILL_FORMED_RANGE };
      default:
        return { message: MSG_ORDER_INVALID };
    }
  };
}
