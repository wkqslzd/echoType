import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ARTICLE_MAX,
  ARTICLE_MIN,
  SHORT_MAX,
  SHORT_MIN,
  parseAnnotatedTxt,
  type CourseDTO,
  type CourseMode,
} from '@echotype/shared';
import { ApiError } from '../../lib/api';
import { useCheckTitleAvailable, useSaveCourse } from '../../guest/useCourseCatalog';
import { modeCoursesLabel } from '../../lib/modeCoursesLabel';
import { AnnotatedText } from '../AnnotatedText';
import { InfoTooltip } from '../InfoTooltip';
import { OptionalDescriptionField } from '../OptionalDescriptionField';
import { AnnotatedTextEditor, confirmAbandonPick } from './AnnotatedTextEditor';
import {
  MSG_CONTENT_REVIEW_WARNING,
  MSG_DISCARD_ALL_CHANGES,
  MSG_INVALID_REQUEST,
  MSG_NETWORK_ERROR,
  MSG_SERIAL_BLOCK,
  MSG_SERVER_ERROR,
  STEP3_NO_ANNOTATION_MESSAGE,
  formatPurgedAnnotationsMessage,
  MSG_REVIEW_BLOCK,
  MSG_REVIEW_COMPLETE,
  mapModeIssueMessage,
  formatContentIssueMessage,
} from './annotationMessages';
import { ReviewPanel } from './ReviewPanel';
import type { AnnotationIssue, ContentIssue, ModeIssue } from '@echotype/shared';
import { useCourseEditor, type EditorMode } from './useCourseEditor';

interface CourseEditorModalProps {
  mode: EditorMode;
  course?: CourseDTO; // present when editing
  /** Locks mode for create (from list route) and must match course.mode when editing. */
  presetCourseMode: CourseMode;
  /** When creating from a collection detail page, assign the new course to this collection. */
  presetCategoryId?: string;
  onClose: () => void;
  onSaved: (courseId: string) => void;
}

export function CourseEditorModal({
  mode,
  course,
  presetCourseMode,
  presetCategoryId,
  onClose,
  onSaved,
}: CourseEditorModalProps) {
  const lockedCourseMode = mode === 'edit' ? course!.mode : presetCourseMode;
  const ed = useCourseEditor(mode, course, lockedCourseMode);
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [footerHint, setFooterHint] = useState<string | null>(null);
  const [pickState, setPickState] = useState({ active: false, hasUnsavedNote: false });
  const [step1TitleError, setStep1TitleError] = useState<string | null>(null);
  const [titleChecking, setTitleChecking] = useState(false);

  useEffect(() => {
    setStep1TitleError(null);
  }, [ed.title]);

  useEffect(() => {
    if (ed.step !== 3) {
      setPickState({ active: false, hasUnsavedNote: false });
    }
  }, [ed.step]);

  const save = useSaveCourse();
  const checkTitleAvailable = useCheckTitleAvailable();

  function handleApiError(e: ApiError) {
    const body = e.courseBody;
    if (e.status === 409 && body?.error === 'duplicate_course_title') {
      setSubmitError(
        `A course titled "${ed.title.trim()}" already exists in ${modeCoursesLabel(lockedCourseMode)} courses.`,
      );
      return;
    }
    if (e.status === 404) {
      setSubmitError('Course not found — it may have been deleted.');
      return;
    }
    if (e.status === 422) {
      const body = e.courseBody;
      if (body?.error === 'annotation_validation_error' && body.issues) {
        ed.applyServerAnnotationIssues(body.issues as AnnotationIssue[]);
        return;
      }
      if (body?.error === 'mode_length_violation' && body.issues?.[0]) {
        setSubmitError(mapModeIssueMessage(body.issues[0] as ModeIssue));
        return;
      }
      if (body?.error === 'content_validation_error' && body.issues?.[0]) {
        setSubmitError(formatContentIssueMessage(body.issues[0] as ContentIssue));
        return;
      }
    }
    if (e.status === 400) {
      setSubmitError(MSG_INVALID_REQUEST);
      return;
    }
    if (e.status === 0) {
      setSubmitError(MSG_NETWORK_ERROR);
      return;
    }
    if (e.status >= 500) {
      setSubmitError(MSG_SERVER_ERROR);
      return;
    }
    setSubmitError(MSG_SERVER_ERROR);
  }

  function handleSave() {
    setSubmitError(null);
    setFooterHint(null);

    if (ed.reviewActive && ed.pendingReviewCount > 0) {
      setSubmitError(MSG_REVIEW_BLOCK);
      return;
    }

    const pre = ed.validateBeforeSave();
    if (!pre.ok) {
      if (pre.kind === 'd5') {
        setSubmitError(STEP3_NO_ANNOTATION_MESSAGE);
        return;
      }
      if (pre.kind === 'mode') {
        setSubmitError(pre.message);
        return;
      }
      if (pre.kind === 'content') {
        setSubmitError(pre.message);
        return;
      }
      if (pre.kind === 'annotation') {
        ed.applyAnnotationValidationFeedback(pre.issues, pre.messages, pre.highlightLocalId);
        return;
      }
    }

    const payload = ed.buildPayload();
    const withCategory =
      mode === 'create' && presetCategoryId ? { ...payload, categoryId: presetCategoryId } : payload;
    save.mutate(
      {
        mode,
        payload: withCategory,
        courseId: mode === 'edit' ? course!.id : undefined,
      },
      {
        onSuccess: (saved) => onSaved(saved.id),
        onError: (e: unknown) => {
          if (e instanceof ApiError) {
            handleApiError(e);
            return;
          }
          setSubmitError(MSG_NETWORK_ERROR);
        },
      },
    );
  }

  function handleNext() {
    void runHandleNext();
  }

  async function runHandleNext() {
    setFooterHint(null);
    if (ed.step === 3) {
      if (pickState.active) {
        setFooterHint(MSG_SERIAL_BLOCK);
        return;
      }
      if (ed.needAnnotation && ed.annotations.length === 0) {
        setFooterHint(STEP3_NO_ANNOTATION_MESSAGE);
        return;
      }
      if (ed.reviewActive && ed.pendingReviewCount > 0) {
        setFooterHint(MSG_REVIEW_BLOCK);
        return;
      }
      ed.clearSubmitFeedback();
    }
    if (!ed.canProceed || titleChecking) return;

    if (ed.step === 1) {
      setStep1TitleError(null);
      const trimmedTitle = ed.title.trim();
      const titleUnchanged = mode === 'edit' && trimmedTitle === (course?.title ?? '');
      if (!titleUnchanged) {
        setTitleChecking(true);
        try {
          const { available } = await checkTitleAvailable(
            lockedCourseMode,
            trimmedTitle,
            mode === 'edit' ? course!.id : undefined,
          );
          if (!available) {
            setStep1TitleError(
              `A course titled "${trimmedTitle}" already exists in ${modeCoursesLabel(lockedCourseMode)} courses.`,
            );
            return;
          }
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 0) {
            setStep1TitleError(MSG_NETWORK_ERROR);
          } else {
            setStep1TitleError(MSG_SERVER_ERROR);
          }
          return;
        } finally {
          setTitleChecking(false);
        }
      }
    }

    const effect = ed.goNext();
    if (effect && effect.purgedAnnotations > 0) {
      setToast(formatPurgedAnnotationsMessage(effect.purgedAnnotations));
    }
  }

  function handleBack() {
    setFooterHint(null);
    setSubmitError(null);
    if (ed.step === 3 && !confirmAbandonPick(pickState.active, pickState.hasUnsavedNote)) return;
    if (ed.step === 3) setPickState({ active: false, hasUnsavedNote: false });
    ed.goBack();
  }

  /** Dismiss the entire editor (X button or backdrop). Back is a separate, narrower action. */
  function handleDismiss() {
    const needsConfirm = ed.isDirty || pickState.active;
    if (needsConfirm && !window.confirm(MSG_DISCARD_ALL_CHANGES)) return;
    onClose();
  }

  const reviewBlocked = ed.reviewActive && ed.pendingReviewCount > 0;
  const nextPrimaryEnabled =
    ed.step === 4
      ? !save.isPending && !reviewBlocked
      : ed.canProceed && !pickState.active && !titleChecking;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={handleDismiss}
    >
      <div
        className="flex max-h-[96vh] w-[min(98vw,1280px)] flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:border dark:border-serika-border dark:bg-serika-surface"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-3 dark:border-serika-border">
          <h2 className="text-lg font-semibold dark:text-serika-text">
            {mode === 'create' ? 'New course' : 'Edit course'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 dark:text-serika-sub">Step {ed.step} / 4</span>
            <button
              type="button"
              aria-label="Close editor"
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-serika-sub dark:hover:bg-serika-raised dark:hover:text-serika-text"
              data-testid="editor-close"
            >
              <span className="block text-xl leading-none" aria-hidden>
                ×
              </span>
            </button>
          </div>
        </header>

        {toast && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800 dark:border-serika-main/50 dark:bg-serika-main/15 dark:text-serika-main">
            {toast}
            <button type="button" className="ml-2 underline" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ed.step === 1 && <Step1 ed={ed} titleAvailabilityError={step1TitleError} />}
          {ed.step === 2 && <Step2 ed={ed} />}
          {ed.step === 3 && <Step3 ed={ed} onPickStateChange={setPickState} />}
          {ed.step === 4 && <Step4Review ed={ed} />}
        </div>

        <footer className="border-t px-5 py-3 dark:border-serika-border">
          {footerHint && (
            <p className="mb-2 text-sm text-amber-700 dark:text-serika-main" data-testid="editor-footer-hint">
              {footerHint}
            </p>
          )}
          {ed.step === 4 && submitError && (
            <p
              className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              data-testid="editor-submit-error"
            >
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between">
            {ed.step > 1 ? (
              <button
                onClick={handleBack}
                className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {ed.step === 4 ? (
              <button
                onClick={handleSave}
                disabled={!nextPrimaryEnabled}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  nextPrimaryEnabled
                    ? 'bg-slate-900 hover:bg-slate-800 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50]'
                    : 'cursor-not-allowed bg-slate-400 opacity-80 dark:border-serika-border dark:bg-transparent dark:text-serika-sub dark:opacity-100'
                }`}
              >
                {save.isPending ? 'Saving…' : 'Save course'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!nextPrimaryEnabled}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  nextPrimaryEnabled
                    ? 'bg-slate-900 hover:bg-slate-800 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50]'
                    : 'cursor-not-allowed bg-slate-400 opacity-80 dark:border-serika-border dark:bg-transparent dark:text-serika-sub dark:opacity-100'
                }`}
              >
                {titleChecking ? 'Checking…' : 'Next'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

const MSG_IMPORT_OVERWRITE_CONFIRM =
  'Importing will replace the current text and annotations. Continue?';

function Step1({
  ed,
  titleAvailabilityError,
}: {
  ed: ReturnType<typeof useCourseEditor>;
  titleAvailabilityError: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after a fix
    if (!file) return;

    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setImportError('Could not read the file. Please try again.');
      return;
    }

    const result = parseAnnotatedTxt(raw, ed.courseMode);
    if (!result.ok) {
      // Keep existing content untouched on failure.
      setImportError(result.error);
      return;
    }

    const hasExisting = ed.content.trim() !== '' || ed.annotations.length > 0;
    if (hasExisting && !window.confirm(MSG_IMPORT_OVERWRITE_CONFIRM)) return;

    setImportError(null);
    ed.importParsed(result.content, result.annotations);
  }

  const len = ed.content.length;
  const modeLabel = ed.courseMode === 'SHORT' ? 'Short mode' : 'Article mode';
  const modeRange =
    ed.courseMode === 'SHORT'
      ? `${SHORT_MIN}–${SHORT_MAX} characters`
      : `${ARTICLE_MIN}–${ARTICLE_MAX} characters`;
  const modeHint =
    ed.courseMode === 'SHORT'
      ? 'Best for quotes, short poems, a single sentence or paragraph'
      : 'Best for full speeches, poems, essays, self-contained passages';

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm text-slate-600 dark:text-serika-sub">Course title</span>
        <input
          className="mt-1 w-full rounded border px-3 py-2 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          value={ed.title}
          onChange={(e) => ed.setTitle(e.target.value)}
          placeholder="e.g. Stray Birds - 49"
        />
      </label>

      <OptionalDescriptionField value={ed.description} onChange={ed.setDescription} />

      <div className="rounded-md border bg-slate-50 px-3 py-2 dark:border-serika-border dark:bg-serika-raised">
        <p className="text-sm font-medium text-slate-800 dark:text-serika-text">{modeLabel}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-serika-sub">
          {modeHint} ({modeRange})
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-serika-sub">
          Mode is set by the list you opened this course from and cannot be changed here.
        </p>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <label htmlFor="step1-content" className="text-sm text-slate-600 dark:text-serika-sub">
            Text content ({len} characters, incl. spaces and line breaks)
          </label>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised"
              data-testid="txt-import-button"
            >
              Import from .txt
            </button>
            <InfoTooltip
              ariaLabel="About importing from .txt"
              placement="bottom"
              align="end"
              panelClassName="w-80"
            >
              <span className="block text-left">
                <span className="block">
                  Imports text from a .txt file. Plain text works as-is — use the format below
                  only if you want to add annotations in one step.
                </span>
                <span className="mt-1.5 block font-medium">Format: {'{phrase}{annotation}'}</span>
                <span className="mt-1 block">
                  Example: the undiscovered country, from whose {'{bourn}{boundary; limit}'} no
                  traveller returns.
                </span>
                <span className="mt-1 block">Rules:</span>
                <span className="block">
                  • Each {'{phrase}'} must be immediately followed by {'{annotation}'}
                </span>
                <span className="block">
                  • Curly braces {'{ }'} cannot appear in plain text
                </span>
              </span>
            </InfoTooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleImportFile}
              data-testid="txt-import-input"
            />
          </span>
        </div>
        <textarea
          id="step1-content"
          className="mt-1 h-44 w-full rounded border px-3 py-2 font-mono text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          value={ed.content}
          onChange={(e) => {
            setImportError(null);
            ed.setContent(e.target.value);
          }}
          placeholder="Enter the English text to practice…"
        />
      </div>

      {importError && (
        <p
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-serika-main/50 dark:bg-serika-main/15 dark:text-serika-main"
          data-testid="txt-import-error"
        >
          Import failed — {importError}
        </p>
      )}
      {ed.showContentWarning && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-serika-main/50 dark:bg-serika-main/15 dark:text-serika-main">
          {MSG_CONTENT_REVIEW_WARNING}
        </p>
      )}
      {ed.step1Error && <p className="text-sm text-amber-600 dark:text-serika-main">{ed.step1Error}</p>}
      {titleAvailabilityError && (
        <p className="text-sm text-amber-600 dark:text-serika-main">{titleAvailabilityError}</p>
      )}
    </div>
  );
}

function Step2({ ed }: { ed: ReturnType<typeof useCourseEditor> }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-slate-600 dark:text-serika-sub">Text preview (how the typing page will show it):</p>
        <AnnotatedText content={ed.content} annotations={[]} />
      </div>

      {/* The Yes/No question only makes sense when nothing is staged yet — a .txt
          import with valid markers already answered it (needAnnotation = true). */}
      {!ed.skipAnnotationChoice && ed.annotations.length === 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-600 dark:text-serika-sub">Do you want to add annotations?</legend>
          <div className="flex gap-3">
            <button
              onClick={() => ed.setNeedAnnotation(true)}
              className={`rounded-md border px-4 py-2 text-sm ${
                ed.needAnnotation === true
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text'
                  : 'bg-white text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => ed.setNeedAnnotation(false)}
              className={`rounded-md border px-4 py-2 text-sm ${
                ed.needAnnotation === false
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text'
                  : 'bg-white text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised'
              }`}
            >
              No
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function Step3({
  ed,
  onPickStateChange,
}: {
  ed: ReturnType<typeof useCourseEditor>;
  onPickStateChange: (s: { active: boolean; hasUnsavedNote: boolean }) => void;
}) {
  const [reviewCommand, setReviewCommand] = useState<{
    type: 'reanchor';
    localId: number;
    nonce: number;
  } | null>(null);

  function handleReselect(localId: number) {
    ed.focusAnnotation(localId);
    setReviewCommand({ type: 'reanchor', localId, nonce: Date.now() });
  }

  const yellowLocalIds = useMemo(
    () => new Set(ed.pendingReviewAnnotations.map((a) => a.localId)),
    [ed.pendingReviewAnnotations],
  );
  const reviewPickGate = ed.reviewActive && ed.pendingReviewCount > 0;

  return (
    <div className="space-y-0">
      {ed.reviewActive && ed.pendingReviewCount > 0 && (
        <ReviewPanel
          items={ed.pendingReviewAnnotations}
          onFocus={ed.focusAnnotation}
          onReselect={handleReselect}
          onDelete={ed.deleteAnnotation}
        />
      )}
      {ed.reviewActive && ed.pendingReviewCount === 0 && ed.annotations.length > 0 && (
        <p
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          data-testid="review-complete-banner"
        >
          {MSG_REVIEW_COMPLETE}
        </p>
      )}
      <AnnotatedTextEditor
        content={ed.content}
        annotations={ed.annotations}
        onCreate={ed.addAnnotation}
        onUpdate={ed.updateAnnotation}
        onDelete={ed.deleteAnnotation}
        onPickStateChange={onPickStateChange}
        highlightLocalId={ed.highlightLocalId}
        submitIssueMessages={ed.submitIssueMessages}
        reviewActive={ed.reviewActive}
        reviewPickGate={reviewPickGate}
        yellowLocalIds={yellowLocalIds}
        reviewCommand={reviewCommand}
      />
    </div>
  );
}

function Step4Review({ ed }: { ed: ReturnType<typeof useCourseEditor> }) {
  const previewAnnotations = ed.annotations.map((a) => ({
    id: String(a.localId),
    startIndex: a.startIndex,
    endIndex: a.endIndex,
    noteText: a.noteText,
  }));

  return (
    <div className="space-y-4" data-testid="step4-review">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-serika-text">{ed.title.trim()}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-serika-sub">
          {ed.courseMode} · {ed.content.length} characters · {ed.annotations.length} annotation
          {ed.annotations.length === 1 ? '' : 's'}
        </p>
      </div>

      <p className="text-sm text-slate-600 dark:text-serika-sub">
        Check annotation placement before saving. This preview matches the typing page layout.
      </p>

      <AnnotatedText content={ed.content} annotations={previewAnnotations} />
    </div>
  );
}
