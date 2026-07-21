import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sanitizeTxtFilename,
  serializeAnnotatedTxt,
  type AnnotationDTO,
  type CourseDTO,
  type CourseMode,
  type CreateSessionInput,
  type PasteRange,
} from '@echotype/shared';
import { api, isCourseNotFoundError } from '../lib/api';
import { describeQueryError } from '../lib/apiErrors';
import { PageError } from '../components/page-status/PageError';
import { PageLoading } from '../components/page-status/PageLoading';
import { useAuth } from '../auth/AuthProvider';
import { useCourseById } from '../guest/useCourseCatalog';
import { InfoTooltip } from '../components/InfoTooltip';
import { CourseDescriptionPanel } from '../components/CourseDescriptionPanel';
import { AnnotatedText } from '../components/AnnotatedText';
import { TypingLeaveDialog } from '../components/typing/TypingLeaveDialog';
import { SessionTimerStrip, type SessionTimerStripPhase } from '../components/typing/SessionTimerStrip';
import { TimerEndDialog } from '../components/typing/TimerEndDialog';
import {
  resolveTimedDurationMinutes,
} from '../lib/sessionTimer';
import {
  alignedProgress,
  buildTargetStatuses,
  clampTyped,
  countAlignedErrors,
  isPassComplete,
  type AlignMode,
} from '../lib/typingAlign';
import {
  collectionDetailPath,
  modeListPath,
} from '../lib/collectionPaths';
import {
  IMMERSIVE_MODE_STORAGE_KEY,
  readForgivingModePreference,
  writeForgivingModePreference,
  readSessionTimerHiddenPreference,
  writeSessionTimerHiddenPreference,
  TYPING_TEXTAREA_CLASS,
  TYPING_TEXTAREA_IMMERSIVE_CLASS,
  formatTypingDuration,
} from '../lib/typingSurface';
import { useNightMode } from '../lib/NightModeProvider';
import {
  clearImmersiveTextareaPosition,
  positionImmersiveTextareaAtCursor,
  scrollPassageToTypingCursor,
  scrollTextareaToCaret,
} from '../lib/typingScroll';
import { usePassageMaxHeight } from '../lib/usePassageMaxHeight';

const IDLE_MS = 5000;
const TICK_MS = 100;
const COURSE_NOT_FOUND_REDIRECT_SEC = 5;
const SESSION_ACTION_BTN_BASE =
  'flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:disabled:opacity-100';

/** Night secondary actions (Pause / Start over): cream label when enabled, muted when disabled. */
const SESSION_SECONDARY_BTN_NIGHT =
  'dark:border-serika-sub dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised dark:disabled:border-serika-border dark:disabled:bg-serika-bg dark:disabled:text-serika-sub dark:disabled:hover:bg-serika-bg';

/** Night primary Save: soft fill + cream label when enabled; flat muted when disabled. */
const SESSION_PRIMARY_BTN_NIGHT =
  'dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:hover:bg-transparent';

declare global {
  interface Window {
    __phase6Timer?: {
      expireNow: () => void;
      getRemainingSec: () => number | null;
      /** DEV: open config, set preset, and confirm armed duration. */
      armTimed: (minutes: number) => void;
    };
    __phase7Pause?: {
      pauseSession: () => void;
      isPaused: () => boolean;
      getActiveMs: () => number;
    };
  }
}

function readImmersiveModePreference(): boolean {
  try {
    return localStorage.getItem(IMMERSIVE_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function TypingModeSwitch({
  checked,
  disabled,
  label,
  ariaLabel,
  testId,
  onChange,
  tooltip,
  className,
  tooltipAlign = 'center',
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  ariaLabel: string;
  testId: string;
  onChange: (enabled: boolean) => void;
  tooltip: ReactNode;
  className?: string;
  tooltipAlign?: 'center' | 'end';
}) {
  return (
    <div className={`flex items-center gap-3${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-serika-bg ${
          checked
            ? 'bg-slate-900 dark:border-transparent dark:bg-serika-sub'
            : 'bg-slate-200 dark:border-serika-border dark:bg-serika-bg'
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked
              ? 'translate-x-5 dark:bg-serika-text'
              : 'translate-x-0 dark:bg-serika-sub'
          }`}
        />
      </button>
      <span className="inline-flex items-center gap-1 text-sm font-medium leading-tight text-slate-700 dark:text-serika-sub">
        {label}
        <InfoTooltip ariaLabel={ariaLabel} placement="bottom" align={tooltipAlign}>
          {tooltip}
        </InfoTooltip>
      </span>
    </div>
  );
}

function CourseNotFoundPanel() {
  const navigate = useNavigate();
  const [secLeft, setSecLeft] = useState(COURSE_NOT_FOUND_REDIRECT_SEC);

  useEffect(() => {
    if (secLeft <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const id = window.setTimeout(() => setSecLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secLeft, navigate]);

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-6 dark:border-serika-border dark:bg-serika-surface">
      <p className="font-medium text-slate-900 dark:text-serika-sub">Course not found</p>
      <p className="text-sm text-slate-600 dark:text-serika-sub">
        This course was deleted or is no longer available.
      </p>
      <p className="text-sm text-slate-500 dark:text-serika-sub">Redirecting to home in {secLeft}s…</p>
      <Link to="/" className="text-sm text-slate-700 underline hover:text-slate-900 dark:text-serika-sub dark:hover:text-serika-text">
        Go now
      </Link>
    </div>
  );
}

export function TypingPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useAuth();
  const isGuest = status === 'guest';
  const { data: course, isLoading, isError, error, refetch } = useCourseById(id);

  if (isLoading) {
    return <PageLoading />;
  }

  if (isError) {
    if (isCourseNotFoundError(error)) {
      return <CourseNotFoundPanel />;
    }
    const copy = describeQueryError(error);
    return (
      <PageError
        title={copy.title}
        description={copy.description}
        onRetry={copy.retryable ? () => void refetch() : undefined}
      />
    );
  }

  if (!course) {
    return null;
  }

  return (
    <TypingSession
      key={course.id}
      courseId={course.id}
      courseMode={course.mode}
      categoryId={course.categoryId}
      target={course.content}
      title={course.title}
      description={course.description}
      annotations={course.annotations}
      isGuest={isGuest}
    />
  );
}

function typingBackPath(mode: CourseMode, categoryId: string | null): string {
  if (categoryId) return collectionDetailPath(mode, categoryId);
  return modeListPath(mode);
}

function TypingSession({
  courseId,
  courseMode,
  categoryId,
  target,
  title,
  description,
  annotations,
  isGuest,
}: {
  courseId: string;
  courseMode: CourseMode;
  categoryId: string | null;
  target: string;
  title: string;
  description: string | null;
  annotations: AnnotationDTO[];
  isGuest: boolean;
}) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  /** Raw textarea value (mirrors the DOM, incl. IME preedit). Invariant: draft === textarea value. */
  const [draft, setDraft] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loopCount, setLoopCount] = useState(0);
  const [sessionCharCount, setSessionCharCount] = useState(0);
  const [sessionErrorCount, setSessionErrorCount] = useState(0);
  const [pasteRanges, setPasteRanges] = useState<PasteRange[]>([]);
  const [activeMs, setActiveMs] = useState(0);
  /** Stats from the most recent successful Save; shown while user continues typing. */
  const [lastSaved, setLastSaved] = useState<null | {
    durationSec: number;
    wpm: number;
    accuracy: number;
    errorCount: number;
    charCount: number;
    loopCount: number;
  }>(null);
  const [immersiveMode, setImmersiveMode] = useState(readImmersiveModePreference);
  const [typingInputFocused, setTypingInputFocused] = useState(true);
  const [forgivingMode, setForgivingMode] = useState(readForgivingModePreference);
  const { effectiveNight, hasOverride, setNightEnabled, clearToSystem } = useNightMode();
  const alignMode: AlignMode = forgivingMode ? 'forgiving' : 'strict';
  const [sessionTimerHidden, setSessionTimerHidden] = useState(readSessionTimerHiddenPreference);
  const [statsHidden, setStatsHidden] = useState(false);
  const [leaveSaveError, setLeaveSaveError] = useState<string | null>(null);

  const [timerConfigOpen, setTimerConfigOpen] = useState(false);
  const [armedMinutes, setArmedMinutes] = useState<number | null>(null);
  const [presetMinutes, setPresetMinutes] = useState(30);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [timerVisitDone, setTimerVisitDone] = useState(false);
  const [countdownStarted, setCountdownStarted] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [timerEndOpen, setTimerEndOpen] = useState(false);
  const [timerEndSaveError, setTimerEndSaveError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const armedMinutesRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const activeMsRef = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const passageScrollRef = useRef<HTMLDivElement>(null);
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);
  const layoutRootRef = useRef<HTMLDivElement>(null);
  const passageMaxHeight = usePassageMaxHeight(
    passageScrollRef,
    inputPanelRef,
    statsPanelRef,
    layoutRootRef,
  );
  const pendingScrollRestoreRef = useRef<{ x: number; y: number } | null>(null);
  const lastActivityAtRef = useRef<number | null>(null);
  const pasteMetaRef = useRef<{ start: number; end: number; clipLen: number } | null>(null);
  /** True between compositionstart and compositionend (IME in progress). */
  const composingRef = useRef(false);
  const countdownStartedAtRef = useRef<number | null>(null);
  const countdownTotalSecRef = useRef<number | null>(null);
  const remainingSecRef = useRef<number | null>(null);

  const hasUnsavedProgress = startedAt !== null;
  const shouldBlockNavigation = !isGuest && (hasUnsavedProgress || timerEndOpen);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlockNavigation && currentLocation.pathname !== nextLocation.pathname,
  );

  const showLeaveDialog = blocker.state === 'blocked' && !timerEndOpen;

  useEffect(() => {
    remainingSecRef.current = remainingSec;
  }, [remainingSec]);

  useEffect(() => {
    armedMinutesRef.current = armedMinutes;
  }, [armedMinutes]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    activeMsRef.current = activeMs;
  }, [activeMs]);

  const timerStripPhase: SessionTimerStripPhase = countdownStarted
    ? 'running'
    : armedMinutes != null
      ? 'armed'
      : timerConfigOpen
        ? 'configuring'
        : 'idle';

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__phase6Timer = {
      expireNow: () => {
        setRemainingSec(0);
        setTimerEndOpen(true);
      },
      getRemainingSec: () => remainingSecRef.current,
      armTimed: (minutes: number) => {
        setTimerConfigOpen(false);
        setArmedMinutes(minutes);
        setPresetMinutes(minutes);
        setCustomMinutesInput('');
        setDurationError(null);
      },
    };
    window.__phase7Pause = {
      pauseSession: () => {
        setPaused(true);
        pausedRef.current = true;
      },
      isPaused: () => pausedRef.current,
      getActiveMs: () => activeMsRef.current,
    };
    return () => {
      delete window.__phase6Timer;
      delete window.__phase7Pause;
    };
  }, []);

  useEffect(() => {
    if (showLeaveDialog) {
      setLeaveSaveError(null);
    }
  }, [showLeaveDialog]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const touchActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const last = lastActivityAtRef.current;
      if (last === null) return;
      if (Date.now() - last < IDLE_MS) {
        setActiveMs((ms) => ms + TICK_MS);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const typingStatuses = useMemo(
    () => buildTargetStatuses(typed, target, alignMode),
    [typed, target, alignMode],
  );

  const liveStats = useMemo(() => {
    const errors = countAlignedErrors(typed, target, alignMode);
    const accuracy = typed.length === 0 ? 1 : 1 - errors / typed.length;
    return { errors, accuracy };
  }, [typed, target, alignMode]);

  const elapsedSecWhole = Math.floor(activeMs / 1000);
  const wpm =
    elapsedSecWhole > 0 ? sessionCharCount / 5 / (elapsedSecWhole / 60) : 0;
  const progress = alignedProgress(typed, target, alignMode);
  /** Completed passes in the current unsaved segment (see docs/STATS.md §3). */
  const completedLoops = startedAt !== null ? loopCount : null;

  function clearPaused() {
    setPaused(false);
    pausedRef.current = false;
  }

  function resumeFromPause() {
    if (!pausedRef.current) return;
    if (countdownStarted && remainingSecRef.current != null) {
      const now = Date.now();
      countdownStartedAtRef.current = now;
      countdownTotalSecRef.current = remainingSecRef.current;
    }
    clearPaused();
  }

  function beginFreshSession() {
    setTyped('');
    setDraft('');
    setStartedAt(null);
    setLoopCount(0);
    setSessionCharCount(0);
    setSessionErrorCount(0);
    setPasteRanges([]);
    setActiveMs(0);
    lastActivityAtRef.current = null;
    clearPaused();
  }

  function startCountdown(minutes: number) {
    const totalSec = minutes * 60;
    const now = Date.now();
    countdownStartedAtRef.current = now;
    countdownTotalSecRef.current = totalSec;
    setCountdownStarted(true);
    setRemainingSec(totalSec);
  }

  function resetTimerState() {
    setTimerVisitDone(false);
    setTimerConfigOpen(false);
    setArmedMinutes(null);
    setPresetMinutes(30);
    setCustomMinutesInput('');
    setDurationError(null);
    setCountdownStarted(false);
    setRemainingSec(null);
    countdownStartedAtRef.current = null;
    countdownTotalSecRef.current = null;
    clearPaused();
  }

  function completeTimerBlock() {
    setTimerEndOpen(false);
    setTimerEndSaveError(null);
    setTimerVisitDone(true);
    setTimerConfigOpen(false);
    setArmedMinutes(null);
    setCountdownStarted(false);
    setRemainingSec(null);
    countdownStartedAtRef.current = null;
    countdownTotalSecRef.current = null;
  }

  useEffect(() => {
    if (!countdownStarted || timerEndOpen || timerVisitDone) return;
    const tick = () => {
      if (pausedRef.current) return;
      const startAt = countdownStartedAtRef.current;
      const total = countdownTotalSecRef.current;
      if (startAt == null || total == null) return;
      const elapsed = Math.floor((Date.now() - startAt) / 1000);
      const left = total - elapsed;
      if (left <= 0) {
        setRemainingSec(0);
        setTimerEndOpen(true);
      } else {
        setRemainingSec(left);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdownStarted, timerEndOpen, timerVisitDone]);

  function buildSessionPayload(): CreateSessionInput {
    if (!startedAt) {
      throw new Error('Nothing to save');
    }
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round(activeMs / 1000));
    const partialErrors = typed.length > 0 ? countAlignedErrors(typed, target, alignMode) : 0;
    const errorCount = sessionErrorCount + partialErrors;
    const finalWpm = durationSec > 0 ? sessionCharCount / 5 / (durationSec / 60) : 0;
    const accuracy = sessionCharCount === 0 ? 1 : 1 - errorCount / sessionCharCount;

    return {
      courseId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec,
      charCount: sessionCharCount,
      errorCount,
      wpm: Number(finalWpm.toFixed(2)),
      accuracy: Number(accuracy.toFixed(4)),
      loopCount,
      pasteRanges,
    };
  }

  const submitMutation = useMutation({
    mutationFn: (input: CreateSessionInput) => api.createSession(input),
    onSuccess: (data) => {
      const s = data.session;
      setLastSaved({
        durationSec: s.durationSec,
        wpm: s.wpm,
        accuracy: s.accuracy,
        errorCount: s.errorCount,
        charCount: s.charCount,
        loopCount: s.loopCount,
      });
      queryClient.setQueryData<CourseDTO>(['course', courseId], (old) =>
        old ? { ...old, stats: data.courseStats } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['courses', courseMode] });
      void queryClient.invalidateQueries({ queryKey: ['stats', 'summary'] });
      beginFreshSession();
      queueMicrotask(() => textareaRef.current?.focus());
    },
  });

  function handleForgivingModeChange(enabled: boolean) {
    setForgivingMode(enabled);
    try {
      writeForgivingModePreference(enabled);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function handleImmersiveModeChange(enabled: boolean) {
    pendingScrollRestoreRef.current = { x: window.scrollX, y: window.scrollY };
    setImmersiveMode(enabled);
    try {
      localStorage.setItem(IMMERSIVE_MODE_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
    queueMicrotask(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  }

  useLayoutEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (pending) {
      window.scrollTo(pending.x, pending.y);
      pendingScrollRestoreRef.current = null;
    }
  }, [immersiveMode]);

  useLayoutEffect(() => {
    const passage = passageScrollRef.current;
    const panel = inputPanelRef.current;
    const textarea = textareaRef.current;
    if (!passage) return;

    scrollPassageToTypingCursor(passage);

    if (textarea && panel) {
      if (immersiveMode) {
        positionImmersiveTextareaAtCursor(textarea, passage, panel);
      } else {
        clearImmersiveTextareaPosition(textarea);
      }
    }
  }, [typed, typingStatuses, immersiveMode]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || immersiveMode) return;
    scrollTextareaToCaret(el);
  }, [draft, immersiveMode]);

  /** Commit a settled (non-composing) textarea value into the aligned `typed` buffer + stats. */
  function commitDraft(raw: string) {
    if (timerEndOpen) return;

    const armed = armedMinutesRef.current;
    if (armed != null && countdownStartedAtRef.current == null) {
      startCountdown(armed);
    }

    const normalized = clampTyped(raw, target, alignMode);

    if (pasteMetaRef.current) {
      const { start, end, clipLen } = pasteMetaRef.current;
      pasteMetaRef.current = null;
      const replaced = end - start;
      const netAdded = normalized.length - typed.length + replaced;
      if (netAdded > 0) {
        const length = Math.min(clipLen, netAdded);
        setPasteRanges((ranges) => [...ranges, { start, length }]);
      }
    }

    if (!startedAt && normalized.length > 0) {
      const now = Date.now();
      setStartedAt(new Date(now));
      lastActivityAtRef.current = now;
    }

    if (normalized.length > typed.length) {
      setSessionCharCount((c) => c + (normalized.length - typed.length));
    }

    if (isPassComplete(normalized, target, alignMode)) {
      setSessionErrorCount((c) => c + countAlignedErrors(normalized, target, alignMode));
      setLoopCount((n) => n + 1);
      setTyped('');
      setDraft('');
      return;
    }

    setTyped(normalized);
    if (normalized !== raw) setDraft(normalized);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setDraft(value);
    touchActivity();
    // Hold off diff/stats/loop while an IME composition is active; commit on end.
    if ((e.nativeEvent as InputEvent).isComposing || composingRef.current) return;
    commitDraft(value);
  }

  function handleCompositionStart() {
    composingRef.current = true;
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLTextAreaElement>) {
    composingRef.current = false;
    const value = e.currentTarget.value;
    setDraft(value);
    commitDraft(value);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    resumeFromPause();
    touchActivity();
    const el = e.currentTarget;
    pasteMetaRef.current = {
      start: el.selectionStart ?? typed.length,
      end: el.selectionEnd ?? typed.length,
      clipLen: e.clipboardData.getData('text').length,
    };
  }

  function handleKeyDown(_e: React.KeyboardEvent<HTMLTextAreaElement>) {
    resumeFromPause();
    touchActivity();
  }

  function handlePause() {
    if (!startedAt || timerEndOpen || showLeaveDialog || paused) return;
    setPaused(true);
    pausedRef.current = true;
  }

  function handleFinish() {
    if (!startedAt || timerEndOpen || isGuest) return;
    submitMutation.mutate(buildSessionPayload());
  }

  async function handleTimerEndSave() {
    if (!startedAt || isGuest) return;
    setTimerEndSaveError(null);
    try {
      await submitMutation.mutateAsync(buildSessionPayload());
      completeTimerBlock();
      queueMicrotask(() => textareaRef.current?.focus());
    } catch (err) {
      setTimerEndSaveError(err instanceof Error ? err.message : 'Failed to save session.');
    }
  }

  function handleTimerEndDontSave() {
    beginFreshSession();
    completeTimerBlock();
    queueMicrotask(() => textareaRef.current?.focus());
  }

  function handleTimerConfirm() {
    const resolved = resolveTimedDurationMinutes(presetMinutes, customMinutesInput);
    if (!resolved.ok) {
      setDurationError(resolved.message);
      return;
    }
    setDurationError(null);
    setTimerConfigOpen(false);
    setArmedMinutes(resolved.minutes);
  }

  function handleTimerOpenConfig() {
    setDurationError(null);
    setTimerConfigOpen(true);
  }

  function handleTimerHideIdle() {
    setSessionTimerHidden(true);
    writeSessionTimerHiddenPreference(true);
  }

  function handleTimerShowIdle() {
    setSessionTimerHidden(false);
    writeSessionTimerHiddenPreference(false);
  }

  function handleTimerCancelConfig() {
    setTimerConfigOpen(false);
    setDurationError(null);
  }

  function handlePresetChange(minutes: number) {
    setPresetMinutes(minutes);
    setCustomMinutesInput('');
    setDurationError(null);
  }

  async function handleSaveAndLeave() {
    if (!startedAt || isGuest) return;
    setLeaveSaveError(null);
    try {
      await submitMutation.mutateAsync(buildSessionPayload());
      if (blocker.state === 'blocked') {
        blocker.proceed();
      }
    } catch (err) {
      setLeaveSaveError(err instanceof Error ? err.message : 'Failed to save session.');
    }
  }

  function handleReset() {
    if (
      startedAt &&
      !window.confirm('Discard this session and start from scratch?')
    ) {
      return;
    }
    beginFreshSession();
    setLastSaved(null);
    resetTimerState();
    textareaRef.current?.focus();
  }

  /** Local backup download; pure client-side, no API call (ADR-0018 family). */
  function handleExportTxt() {
    const text = serializeAnnotatedTxt({ title, description, content: target, annotations });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeTxtFilename(title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={layoutRootRef} className="flex flex-col gap-3">
      {showLeaveDialog && (
        <TypingLeaveDialog
          saving={submitMutation.isPending}
          saveError={leaveSaveError}
          loginToSave={isGuest}
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
          onSaveAndLeave={() => void handleSaveAndLeave()}
        />
      )}

      {timerEndOpen && (
        <TimerEndDialog
          saving={submitMutation.isPending}
          saveError={timerEndSaveError}
          canSave={startedAt !== null}
          loginToSave={isGuest}
          onSave={() => void handleTimerEndSave()}
          onDontSave={handleTimerEndDontSave}
        />
      )}

      <div className="shrink-0">
        <div className="flex items-start justify-between">
          {timerEndOpen ? (
            <span className="text-sm text-slate-300 dark:text-slate-600" aria-disabled="true">
              ← Back
            </span>
          ) : (
            <Link
              to={typingBackPath(courseMode, categoryId)}
              className="text-sm text-slate-500 hover:text-slate-800 dark:text-serika-sub dark:hover:text-serika-text"
            >
              ← Back
            </Link>
          )}
          <span className="inline-flex items-center gap-1 text-sm leading-none">
            <InfoTooltip
              ariaLabel="About exporting to .txt"
              placement="bottom"
              align="end"
              size="sm"
              panelClassName="w-72"
            >
              <span className="block text-left">
                <span className="block">
                  Downloads a local backup. Annotated phrases are written as{' '}
                  {'{phrase}{annotation}'} pairs in the file body.
                </span>
                <span className="mt-1.5 block">
                  To re-import in the course editor, use Import from .txt and delete the
                  first two lines (title and description) from the file first.
                </span>
              </span>
            </InfoTooltip>
            <button
              type="button"
              disabled={timerEndOpen}
              onClick={handleExportTxt}
              className={`underline underline-offset-2 ${
                timerEndOpen
                  ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-serika-sub dark:hover:text-serika-text'
              }`}
              data-testid="txt-export-button"
            >
              Export .txt
            </button>
          </span>
        </div>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-serika-sub">{title}</h1>
      </div>

      {description?.trim() && (
        <div className="shrink-0">
          <CourseDescriptionPanel description={description} hideable defaultHidden />
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-2">
        {!timerVisitDone && (
          <div className="flex shrink-0 justify-end">
            <SessionTimerStrip
              phase={timerStripPhase}
              idleHidden={sessionTimerHidden}
              presetMinutes={presetMinutes}
              customMinutesInput={customMinutesInput}
              durationError={durationError}
              armedMinutes={armedMinutes}
              remainingSec={remainingSec}
              paused={paused}
              onOpenConfig={handleTimerOpenConfig}
              onHideIdle={handleTimerHideIdle}
              onShowIdle={handleTimerShowIdle}
              onCancelConfig={handleTimerCancelConfig}
              onConfirm={handleTimerConfirm}
              onPresetChange={handlePresetChange}
              onCustomChange={(value) => {
                setCustomMinutesInput(value);
                setDurationError(null);
              }}
            />
          </div>
        )}

        <div
          ref={passageScrollRef}
          data-testid="typing-passage-scroll"
          style={passageMaxHeight != null ? { maxHeight: passageMaxHeight } : undefined}
          className={`shrink-0 overflow-y-auto overscroll-y-contain ${
            immersiveMode ? 'cursor-text' : ''
          }`}
          onMouseDown={
            immersiveMode
              ? (e) => {
                  if ((e.target as HTMLElement).closest('[role="button"]')) return;
                  e.preventDefault();
                  textareaRef.current?.focus({ preventScroll: true });
                }
              : undefined
          }
        >
          <div className="relative">
            <AnnotatedText
              content={target}
              annotations={annotations}
              typingStatuses={typingStatuses}
              clickableNotes={!showLeaveDialog && !timerEndOpen}
              extendNotes
              framed={false}
            />
            {immersiveMode && !typingInputFocused && (
              <div
                className="pointer-events-none absolute inset-0 z-10 rounded-md bg-amber-50/80 dark:bg-black/70"
                aria-hidden
                data-testid="immersive-passage-unfocused"
              />
            )}
          </div>
        </div>

        {/* relative: containing block for the immersive 1px textarea — without it the
            absolute textarea anchors at the document top-left and every keystroke
            scrolls the caret (page/visual viewport) back there. */}
        <div ref={inputPanelRef} className="relative shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <TypingModeSwitch
            checked={immersiveMode}
            disabled={timerEndOpen}
            label="Immersive mode"
            ariaLabel="About immersive mode"
            testId="immersive-mode"
            onChange={handleImmersiveModeChange}
            tooltip={
              <>
                Hides the typing box so you can focus on the passage. Works best when your keyboard
                matches the passage language. Floating word suggestions may appear off-screen.
              </>
            }
          />
          <TypingModeSwitch
            checked={forgivingMode}
            disabled={timerEndOpen}
            label="Forgiving mode"
            ariaLabel="About forgiving mode"
            testId="forgiving-mode"
            onChange={handleForgivingModeChange}
            tooltip={
              <>
                A lower-pressure way to practice. Accuracy ignores spaces, punctuation, and English
                letter case. You still need to get the letters and numbers right. Saved sessions use
                the same relaxed rules while this mode is on.
              </>
            }
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {hasOverride && (
              <button
                type="button"
                data-testid="night-mode-use-system"
                disabled={timerEndOpen}
                onClick={clearToSystem}
                className="text-xs text-slate-500 underline hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-serika-sub dark:hover:text-serika-text"
              >
                Follow browser setting
              </button>
            )}
            <TypingModeSwitch
              checked={effectiveNight}
              disabled={timerEndOpen}
              label="Night mode"
              ariaLabel="About night mode"
              testId="night-mode"
              onChange={setNightEnabled}
              tooltipAlign="end"
              tooltip={
                <>
                  Softer dark colors for this typing page. By default it follows your browser&apos;s
                  light or dark look (which may or may not match your computer). Flip the switch to
                  choose yourself; use Follow browser setting to go back.
                </>
              }
            />
          </div>
        </div>

        <textarea
          ref={textareaRef}
          data-testid="typing-input"
          autoFocus
          rows={2}
          value={draft}
          disabled={timerEndOpen}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={() => setTypingInputFocused(true)}
          onBlur={() => setTypingInputFocused(false)}
          className={immersiveMode ? TYPING_TEXTAREA_IMMERSIVE_CLASS : TYPING_TEXTAREA_CLASS}
          placeholder={immersiveMode ? undefined : 'Type here…'}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />

        {immersiveMode && (
          <p className="text-sm text-slate-500 dark:text-serika-sub">
            Typing box hidden — click the passage to type. Turn off immersive mode to see your
            input.
          </p>
        )}
        </div>
      </div>

      <div ref={statsPanelRef} className="space-y-3">
        {statsHidden ? (
        <button
          type="button"
          data-testid="stats-show"
          aria-label="Show session stats"
          title="Show session stats"
          onClick={() => setStatsHidden(false)}
          className="group min-w-[1.25rem] text-sm text-slate-300 hover:text-slate-600 dark:text-serika-sub dark:hover:text-serika-text"
        >
          <span className="group-hover:hidden" aria-hidden>
            —
          </span>
          <span className="hidden group-hover:inline">Show stats</span>
        </button>
      ) : (
        <div>
          <StatsBar
            durationSec={elapsedSecWhole}
            wpm={wpm}
            accuracy={liveStats.accuracy}
            progress={progress}
            errors={liveStats.errors}
            completedLoops={completedLoops}
          />
          <button
            type="button"
            data-testid="stats-hide"
            onClick={() => setStatsHidden(true)}
            className="mt-1 text-xs text-slate-500 underline hover:text-slate-800 dark:text-serika-sub dark:hover:text-serika-text"
          >
            Hide
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="pause-session"
            onClick={handlePause}
            disabled={!startedAt || paused || submitMutation.isPending || timerEndOpen || showLeaveDialog}
            className={`${SESSION_ACTION_BTN_BASE} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${SESSION_SECONDARY_BTN_NIGHT}`}
          >
            Pause
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={isGuest || !startedAt || submitMutation.isPending || timerEndOpen}
            className={`${SESSION_ACTION_BTN_BASE} ${
              isGuest
                ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-serika-border dark:bg-serika-bg dark:text-serika-sub'
                : `border border-transparent bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 ${SESSION_PRIMARY_BTN_NIGHT}`
            }`}
          >
            {isGuest ? 'Saving requires sign-in' : submitMutation.isPending ? 'Saving…' : 'Save session'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={timerEndOpen}
            className={`${SESSION_ACTION_BTN_BASE} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${SESSION_SECONDARY_BTN_NIGHT}`}
          >
            Start over
          </button>
        </div>
        {paused && (
          <p data-testid="pause-hint" className="text-sm text-amber-800 dark:text-amber-300">
            Paused — type to resume
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-serika-sub">
          Course statistics update only when you save this session.
        </p>
        </div>

        {lastSaved && (
        <div className="relative rounded-md border border-emerald-200 bg-emerald-50 p-4 pr-10 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          <button
            type="button"
            onClick={() => setLastSaved(null)}
            className="absolute right-2 top-2 rounded p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
            aria-label="Dismiss last saved session stats"
          >
            ×
          </button>
          <p className="font-medium">Last session saved</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            Stats from your most recent save: duration {formatTypingDuration(lastSaved.durationSec)} · wpm{' '}
            {lastSaved.wpm.toFixed(1)} · accuracy {(lastSaved.accuracy * 100).toFixed(1)}% · errors{' '}
            {lastSaved.errorCount} · chars {lastSaved.charCount} · loops {lastSaved.loopCount}
          </p>
        </div>
        )}
        {submitMutation.isError && !showLeaveDialog && !timerEndOpen && (
          <p className="text-sm text-red-600 dark:text-red-400">Failed to save: {(submitMutation.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}

function StatsBar({
  durationSec,
  wpm,
  accuracy,
  progress,
  errors,
  completedLoops,
}: {
  durationSec: number;
  wpm: number;
  accuracy: number;
  progress: number;
  errors: number;
  completedLoops: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-serika-border dark:bg-serika-surface sm:grid-cols-6">
      <Stat label="time" value={formatTypingDuration(durationSec)} valueTestId="stats-time" />
      <Stat label="wpm" value={wpm.toFixed(1)} wpmInfo />
      <Stat label="accuracy" value={`${(accuracy * 100).toFixed(1)}%`} />
      <Stat label="progress" value={`${(progress * 100).toFixed(0)}%`} />
      <Stat label="errors" value={String(errors)} />
      <Stat label="loops" value={completedLoops === null ? '—' : String(completedLoops)} />
    </div>
  );
}

const WPM_TOOLTIP = (
  <>
    <p className="font-medium text-slate-700 dark:text-serika-sub">Words per minute (WPM)</p>
    <p className="mt-1">
      Characters you type, divided by 5, divided by active typing minutes. This is the usual rule from
      English typing tests.
    </p>
    <p className="mt-1">
      EchoType uses that same rule for every course language. For passages that are not written as
      spaced words (Chinese, Japanese, symbol-heavy text, logographic writing, and similar), the score may
      not match a words-per-minute you would estimate by reading the passage.
    </p>
    <p className="mt-1">This is the speed figure stored when you save your session.</p>
  </>
);

function Stat({
  label,
  value,
  valueTestId,
  wpmInfo,
}: {
  label: string;
  value: string;
  valueTestId?: string;
  wpmInfo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {wpmInfo ? (
        <span className="inline-flex items-center gap-1 text-sm leading-tight text-slate-400 dark:text-serika-sub">
          <span className="uppercase">{label}</span>
          <InfoTooltip ariaLabel="About words per minute" placement="top" panelClassName="w-72">
            {WPM_TOOLTIP}
          </InfoTooltip>
        </span>
      ) : (
        <span className="text-sm leading-tight text-slate-400 uppercase dark:text-serika-sub">{label}</span>
      )}
      <div className="font-mono text-sm text-slate-900 dark:text-serika-sub" data-testid={valueTestId}>
        {value}
      </div>
    </div>
  );
}
