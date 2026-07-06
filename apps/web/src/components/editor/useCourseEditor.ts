import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ARTICLE_MAX,
  ARTICLE_MIN,
  SHORT_MAX,
  SHORT_MIN,
  formatContentIssueMessage,
  normalizeLineEndings,
  remapAnnotationIndexAfterLineEndingNormalization,
  validateContentCharacters,
  type AnnotationInput,
  type AnnotationIssue,
  type CourseDTO,
  type CourseMode,
  type CreateCourseInput,
} from '@echotype/shared';
import { annotationIssuesFromApi, runPreSubmitValidation, type PreSubmitResult } from './submitValidation';
import {
  computeReviewStatus,
  dropFullyUnreachableAnnotations,
  listPendingReviewAnnotations,
  sliceAt,
  type ReviewStatus,
} from './reviewUtils';

// Short-lived front-end id for a staged annotation. It only exists while the
// editor modal is open and is never sent to the backend (the server derives its
// own ids + anchoredText). A simple incrementing counter is enough; no nanoid.
export interface DraftAnnotation {
  localId: number;
  startIndex: number;
  endIndex: number; // inclusive
  noteText: string;
  /** Local snapshot for review; server re-derives on save. */
  anchoredText: string;
}

export type EditorStep = 1 | 2 | 3 | 4;
export type EditorMode = 'create' | 'edit';

export { STEP3_NO_ANNOTATION_MESSAGE } from './annotationMessages';

function lengthOk(mode: CourseMode, len: number): boolean {
  return mode === 'SHORT' ? len >= SHORT_MIN && len <= SHORT_MAX : len >= ARTICLE_MIN && len <= ARTICLE_MAX;
}

function resolveInitialEditorState(
  editorMode: EditorMode,
  initial: CourseDTO | undefined,
): { content: string; annotations: DraftAnnotation[]; nextLocalId: number } {
  const rawContent = initial?.content ?? '';
  const content = normalizeLineEndings(rawContent);
  const rawAnnotations = initial?.annotations ?? [];

  if (editorMode === 'edit' && rawContent !== content) {
    const crCount = (rawContent.match(/\r/g) ?? []).length;
    console.log(
      `[EchoType] Normalized ${crCount} legacy CRLF endings; annotation indices remapped.`,
    );
  }

  const contentChanged = rawContent !== content;
  const annotations: DraftAnnotation[] = rawAnnotations.map((a, i) => {
    const startIndex = contentChanged
      ? remapAnnotationIndexAfterLineEndingNormalization(rawContent, a.startIndex)
      : a.startIndex;
    const endIndex = contentChanged
      ? remapAnnotationIndexAfterLineEndingNormalization(rawContent, a.endIndex)
      : a.endIndex;
    return {
      localId: i + 1,
      startIndex,
      endIndex,
      noteText: a.noteText,
      anchoredText: contentChanged ? sliceAt(content, startIndex, endIndex) : a.anchoredText,
    };
  });

  return { content, annotations, nextLocalId: annotations.length + 1 };
}

export interface UseCourseEditor {
  editorMode: EditorMode;
  step: EditorStep;

  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  courseMode: CourseMode;

  needAnnotation: boolean | null;
  setNeedAnnotation: (v: boolean) => void;
  /** Edit flow: course already has annotations — skip Step 2 Yes/No. */
  skipAnnotationChoice: boolean;

  annotations: DraftAnnotation[];
  /** Replace content + annotations from a parsed .txt import (see parseAnnotatedTxt). */
  importParsed: (content: string, annotations: AnnotationInput[]) => void;
  addAnnotation: (a: Omit<DraftAnnotation, 'localId' | 'anchoredText'> & { anchoredText?: string }) => void;
  updateAnnotation: (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => void;
  deleteAnnotation: (localId: number) => void;
  // Step 1 validation
  step1Error: string | null;
  canProceed: boolean;

  /** Edit: content differs from last confirmed baseline (Step 1 Next). */
  contentPendingReview: boolean;
  originalAnnotationCount: number;
  showContentWarning: boolean;

  reviewActive: boolean;
  pendingReviewCount: number;
  pendingReviewAnnotations: DraftAnnotation[];
  getReviewStatus: (localId: number) => ReviewStatus;
  focusAnnotation: (localId: number) => void;

  goNext: () => { purgedAnnotations: number } | void;
  goBack: () => void;
  isDirty: boolean;

  buildPayload: () => CreateCourseInput;

  submitIssueMessages: string[];
  highlightLocalId: number | null;
  validateBeforeSave: () => PreSubmitResult;
  applyAnnotationValidationFeedback: (
    issues: AnnotationIssue[],
    messages: string[],
    highlightLocalId: number | null,
  ) => void;
  applyServerAnnotationIssues: (issues: AnnotationIssue[]) => void;
  clearSubmitFeedback: () => void;
}

export function useCourseEditor(
  editorMode: EditorMode,
  initial: CourseDTO | undefined,
  lockedCourseMode: CourseMode,
): UseCourseEditor {
  const initialState = useMemo(() => resolveInitialEditorState(editorMode, initial), [editorMode, initial]);
  const initialContentNorm = initialState.content;
  const courseMode = lockedCourseMode;

  const [step, setStep] = useState<EditorStep>(1);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [content, setContentState] = useState(initialState.content);
  const setContent = useCallback((v: string) => {
    setContentState(normalizeLineEndings(v));
  }, []);
  const originalAnnotationCount = initial?.annotations?.length ?? 0;

  const [needAnnotation, setNeedAnnotationState] = useState<boolean | null>(() =>
    editorMode === 'edit' && originalAnnotationCount > 0 ? true : null,
  );

  const [annotations, setAnnotations] = useState<DraftAnnotation[]>(() => initialState.annotations);
  const nextLocalId = useRef<number>(initialState.nextLocalId);

  const [submitIssueMessages, setSubmitIssueMessages] = useState<string[]>([]);
  const [highlightLocalId, setHighlightLocalId] = useState<number | null>(null);
  const [reviewActive, setReviewActive] = useState(false);

  /** Last content confirmed on Step 1 Next; advances each successful Next from step 1. */
  const contentBaseline = useRef(initialContentNorm);

  const clearSubmitFeedback = useCallback(() => {
    setSubmitIssueMessages([]);
    setHighlightLocalId(null);
  }, []);

  const focusAnnotation = useCallback((localId: number) => {
    setHighlightLocalId(localId);
  }, []);

  const contentPendingReview =
    content !== contentBaseline.current && annotations.length > 0;
  const showContentWarning = contentPendingReview;

  const pendingReviewAnnotations = useMemo(
    () => listPendingReviewAnnotations(content, annotations, reviewActive),
    [content, annotations, reviewActive],
  );

  const yellowCount = pendingReviewAnnotations.length;

  const getReviewStatus = useCallback(
    (localId: number): ReviewStatus => {
      const ann = annotations.find((a) => a.localId === localId);
      if (!ann) return 'n/a';
      return computeReviewStatus(content, ann, reviewActive);
    },
    [annotations, content, reviewActive],
  );

  // Edit + still has staged annotations: skip Step 2 Yes/No and go straight to Step 3.
  const skipAnnotationChoice = useMemo(
    () => editorMode === 'edit' && annotations.length > 0,
    [editorMode, annotations.length],
  );

  const addAnnotation = useCallback(
    (a: Omit<DraftAnnotation, 'localId' | 'anchoredText'> & { anchoredText?: string }) => {
      clearSubmitFeedback();
      const anchoredText = a.anchoredText ?? sliceAt(content, a.startIndex, a.endIndex);
      setAnnotations((prev) => [...prev, { ...a, anchoredText, localId: nextLocalId.current++ }]);
    },
    [clearSubmitFeedback, content],
  );

  const updateAnnotation = useCallback(
    (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => {
      clearSubmitFeedback();
      setAnnotations((prev) =>
        prev.map((x) => {
          if (x.localId !== localId) return x;
          const next = { ...x, ...patch };
          if (patch.startIndex !== undefined || patch.endIndex !== undefined) {
            const start = patch.startIndex ?? x.startIndex;
            const end = patch.endIndex ?? x.endIndex;
            next.anchoredText = sliceAt(content, start, end);
          }
          return next;
        }),
      );
    },
    [clearSubmitFeedback, content],
  );

  const deleteAnnotation = useCallback(
    (localId: number) => {
      clearSubmitFeedback();
      setAnnotations((prev) => prev.filter((x) => x.localId !== localId));
    },
    [clearSubmitFeedback],
  );

  const importParsed = useCallback(
    (newContent: string, imported: AnnotationInput[]) => {
      clearSubmitFeedback();
      const normalized = normalizeLineEndings(newContent);
      setContentState(normalized);
      // Imported annotations are derived from this exact content, so advance the
      // baseline too — a fresh import must not trigger the Phase 4 review flow.
      contentBaseline.current = normalized;
      setReviewActive(false);
      const drafts: DraftAnnotation[] = imported.map((a) => ({
        localId: nextLocalId.current++,
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        noteText: a.noteText,
        anchoredText: sliceAt(normalized, a.startIndex, a.endIndex),
      }));
      setAnnotations(drafts);
      if (drafts.length > 0) setNeedAnnotationState(true);
    },
    [clearSubmitFeedback],
  );

  const setNeedAnnotation = useCallback((v: boolean) => {
    setNeedAnnotationState(v);
    if (!v) setAnnotations([]);
  }, []);

  const step1Error = useMemo(() => {
    if (!title.trim()) return 'Title is required.';
    if (!content) return 'Text content is required.';
    const contentIssue = validateContentCharacters(content);
    if (contentIssue) return formatContentIssueMessage(contentIssue);
    if (!lengthOk(courseMode, content.length)) {
      return courseMode === 'SHORT'
        ? `Short mode needs ${SHORT_MIN}-${SHORT_MAX} characters (currently ${content.length}).`
        : `Article mode needs ${ARTICLE_MIN}-${ARTICLE_MAX} characters (currently ${content.length}).`;
    }
    return null;
  }, [title, content, courseMode]);

  const canProceed = useMemo(() => {
    if (step === 1) return step1Error === null;
    if (step === 2) return skipAnnotationChoice || needAnnotation !== null;
    if (step === 3) {
      if (needAnnotation === true && annotations.length === 0) return false;
      if (reviewActive && yellowCount > 0) return false;
      return true;
    }
    return true;
  }, [step, step1Error, needAnnotation, annotations.length, skipAnnotationChoice, reviewActive, yellowCount]);

  const goNext = useCallback((): { purgedAnnotations: number } | void => {
    if (step === 1) {
      const contentChangedFromBaseline = content !== contentBaseline.current;
      let purgedAnnotations = 0;

      if (contentChangedFromBaseline && annotations.length > 0) {
        const { kept, purgedCount } = dropFullyUnreachableAnnotations(content, annotations);
        purgedAnnotations = purgedCount;
        if (purgedCount > 0) setAnnotations(kept);

        setReviewActive(kept.length > 0);
      } else if (contentChangedFromBaseline) {
        setReviewActive(annotations.length > 0);
      }

      contentBaseline.current = content;
      setStep(skipAnnotationChoice ? 3 : 2);
      return purgedAnnotations > 0 ? { purgedAnnotations } : undefined;
    }
    if (step === 2) {
      setStep(needAnnotation ? 3 : 4);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
  }, [step, editorMode, annotations.length, content, needAnnotation, skipAnnotationChoice]);

  const goBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(skipAnnotationChoice ? 1 : 2);
    else if (step === 4) setStep(needAnnotation ? 3 : skipAnnotationChoice ? 1 : 2);
  }, [step, needAnnotation, skipAnnotationChoice]);

  const isDirty = useMemo(() => {
    if (editorMode === 'create') {
      return title.trim() !== '' || description.trim() !== '' || content !== '' || annotations.length > 0;
    }
    return (
      title !== (initial?.title ?? '') ||
      description !== (initial?.description ?? '') ||
      content !== initialContentNorm ||
      courseMode !== (initial?.mode ?? 'SHORT') ||
      annotations.length !== originalAnnotationCount
    );
  }, [editorMode, title, description, content, courseMode, annotations.length, initial, originalAnnotationCount, initialContentNorm]);

  const buildPayload = useCallback(
    (): CreateCourseInput => ({
      title: title.trim(),
      content,
      mode: courseMode,
      description: description.trim() || undefined,
      annotations: annotations.map((a) => ({
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        noteText: a.noteText,
      })),
    }),
    [title, content, courseMode, description, annotations],
  );

  const validateBeforeSave = useCallback((): PreSubmitResult => {
    return runPreSubmitValidation(buildPayload(), annotations, needAnnotation);
  }, [buildPayload, annotations, needAnnotation]);

  const applyAnnotationValidationFeedback = useCallback(
    (issues: AnnotationIssue[], messages: string[], localId: number | null) => {
      setSubmitIssueMessages(messages);
      setHighlightLocalId(localId);
      setStep(3);
    },
    [],
  );

  const applyServerAnnotationIssues = useCallback(
    (issues: AnnotationIssue[]) => {
      const payload = buildPayload();
      const { messages, highlightLocalId: localId } = annotationIssuesFromApi(
        issues,
        annotations,
        payload.annotations,
      );
      applyAnnotationValidationFeedback(issues, messages, localId);
    },
    [annotations, buildPayload, applyAnnotationValidationFeedback],
  );

  return {
    editorMode,
    step,
    title,
    setTitle,
    description,
    setDescription,
    content,
    setContent,
    courseMode,
    needAnnotation,
    setNeedAnnotation,
    skipAnnotationChoice,
    annotations,
    importParsed,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    step1Error,
    canProceed,
    contentPendingReview,
    originalAnnotationCount,
    showContentWarning,
    reviewActive,
    pendingReviewCount: yellowCount,
    pendingReviewAnnotations,
    getReviewStatus,
    focusAnnotation,
    goNext,
    goBack,
    isDirty,
    buildPayload,
    submitIssueMessages,
    highlightLocalId,
    validateBeforeSave,
    applyAnnotationValidationFeedback,
    applyServerAnnotationIssues,
    clearSubmitFeedback,
  };
}
