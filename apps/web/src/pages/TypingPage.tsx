import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnnotationDTO, CourseMode, PasteRange } from '@echotype/shared';
import { api, isCourseNotFoundError } from '../lib/api';
import { CourseDescriptionPanel } from '../components/CourseDescriptionPanel';
import { AnnotatedText } from '../components/AnnotatedText';
import {
  alignedProgress,
  buildTargetStatuses,
  clampTyped,
  countAlignedErrors,
  isPassComplete,
} from '../lib/typingAlign';
import {
  IMMERSIVE_MODE_STORAGE_KEY,
  TYPING_TEXTAREA_CLASS,
  TYPING_TEXTAREA_IMMERSIVE_CLASS,
  formatTypingDuration,
} from '../lib/typingSurface';

const IDLE_MS = 5000;
const TICK_MS = 100;
const COURSE_NOT_FOUND_REDIRECT_SEC = 5;

function readImmersiveModePreference(): boolean {
  try {
    return localStorage.getItem(IMMERSIVE_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
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
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-6">
      <p className="font-medium text-slate-900">Course not found</p>
      <p className="text-sm text-slate-600">
        This course was deleted or is no longer available.
      </p>
      <p className="text-sm text-slate-500">Redirecting to home in {secLeft}s…</p>
      <Link to="/" className="text-sm text-slate-700 underline hover:text-slate-900">
        Go now
      </Link>
    </div>
  );
}

export function TypingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading, isError, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id!),
    enabled: !!id,
    retry: (failureCount, err) => {
      if (isCourseNotFoundError(err)) return false;
      return failureCount < 3;
    },
  });

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (isError) {
    if (isCourseNotFoundError(error)) {
      return <CourseNotFoundPanel />;
    }
    return <p className="text-slate-500">Failed to load course.</p>;
  }

  if (!course) {
    return null;
  }

  return (
    <TypingSession
      key={course.id}
      courseId={course.id}
      courseMode={course.mode}
      target={course.content}
      title={course.title}
      description={course.description}
      annotations={course.annotations}
    />
  );
}

function coursesListPath(mode: CourseMode): string {
  return mode === 'SHORT' ? '/courses/short' : '/courses/article';
}

function TypingSession({
  courseId,
  courseMode,
  target,
  title,
  description,
  annotations,
}: {
  courseId: string;
  courseMode: CourseMode;
  target: string;
  title: string;
  description: string | null;
  annotations: AnnotationDTO[];
}) {
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastActivityAtRef = useRef<number | null>(null);
  const pasteMetaRef = useRef<{ start: number; end: number; clipLen: number } | null>(null);
  /** True between compositionstart and compositionend (IME in progress). */
  const composingRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const touchActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => {
      const last = lastActivityAtRef.current;
      if (last === null) return;
      if (Date.now() - last < IDLE_MS) {
        setActiveMs((ms) => ms + TICK_MS);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const typingStatuses = useMemo(() => buildTargetStatuses(typed, target), [typed, target]);

  const liveStats = useMemo(() => {
    const errors = countAlignedErrors(typed, target);
    const accuracy = typed.length === 0 ? 1 : 1 - errors / typed.length;
    return { errors, accuracy };
  }, [typed, target]);

  const elapsedSecWhole = Math.floor(activeMs / 1000);
  const wpm =
    elapsedSecWhole > 0 ? sessionCharCount / 5 / (elapsedSecWhole / 60) : 0;
  const progress = alignedProgress(typed, target);
  const passNumber = startedAt ? loopCount + 1 : null;

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
  }

  const submitMutation = useMutation({
    mutationFn: api.createSession,
    onSuccess: (s) => {
      setLastSaved({
        durationSec: s.durationSec,
        wpm: s.wpm,
        accuracy: s.accuracy,
        errorCount: s.errorCount,
        charCount: s.charCount,
        loopCount: s.loopCount,
      });
      beginFreshSession();
      queueMicrotask(() => textareaRef.current?.focus());
    },
  });

  function handleImmersiveModeChange(enabled: boolean) {
    setImmersiveMode(enabled);
    try {
      localStorage.setItem(IMMERSIVE_MODE_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
    queueMicrotask(() => textareaRef.current?.focus());
  }

  useLayoutEffect(() => {
    if (immersiveMode) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxPx = Math.floor(window.innerHeight * 0.4);
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [draft, immersiveMode]);

  /** Commit a settled (non-composing) textarea value into the aligned `typed` buffer + stats. */
  function commitDraft(raw: string) {
    const normalized = clampTyped(raw, target);

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

    if (isPassComplete(normalized, target)) {
      setSessionErrorCount((c) => c + countAlignedErrors(normalized, target));
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
    touchActivity();
    const el = e.currentTarget;
    pasteMetaRef.current = {
      start: el.selectionStart ?? typed.length,
      end: el.selectionEnd ?? typed.length,
      clipLen: e.clipboardData.getData('text').length,
    };
  }

  function handleFinish() {
    if (!startedAt) return;
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round(activeMs / 1000));
    const partialErrors = typed.length > 0 ? countAlignedErrors(typed, target) : 0;
    const errorCount = sessionErrorCount + partialErrors;
    const finalWpm = durationSec > 0 ? sessionCharCount / 5 / (durationSec / 60) : 0;
    const accuracy = sessionCharCount === 0 ? 1 : 1 - errorCount / sessionCharCount;

    submitMutation.mutate({
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
    });
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
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Link to={coursesListPath(courseMode)} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
      </div>

      {description?.trim() && <CourseDescriptionPanel description={description} />}

      <div
        className={immersiveMode ? 'cursor-text' : undefined}
        onMouseDown={
          immersiveMode
            ? (e) => {
                if ((e.target as HTMLElement).closest('[role="button"]')) return;
                textareaRef.current?.focus();
              }
            : undefined
        }
      >
        <AnnotatedText
          content={target}
          annotations={annotations}
          typingStatuses={typingStatuses}
          clickableNotes
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={immersiveMode}
            aria-label="Immersive mode"
            onClick={() => handleImmersiveModeChange(!immersiveMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              immersiveMode ? 'bg-slate-900' : 'bg-slate-200'
            }`}
          >
            <span
              aria-hidden
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                immersiveMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">Immersive mode</p>
            <p className="text-xs text-slate-400">
              Immersive mode hides the box. Best with English or non-IME input — IME candidate
              windows may appear off-screen.
            </p>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          data-testid="typing-input"
          autoFocus
          rows={1}
          value={draft}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          onKeyDown={touchActivity}
          className={immersiveMode ? TYPING_TEXTAREA_IMMERSIVE_CLASS : TYPING_TEXTAREA_CLASS}
          placeholder={immersiveMode ? undefined : 'Type here…'}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />

        {immersiveMode && (
          <p className="text-sm text-slate-500">
            Typing box hidden — click the passage or start typing. Turn off immersive mode to view
            or copy your input.
          </p>
        )}
      </div>

      <StatsBar
        durationSec={elapsedSecWhole}
        wpm={wpm}
        accuracy={liveStats.accuracy}
        progress={progress}
        errors={liveStats.errors}
        pass={passNumber}
      />

      <div className="flex gap-2">
        <button
          onClick={handleFinish}
          disabled={!startedAt || submitMutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitMutation.isPending ? 'Saving…' : 'Save session'}
        </button>
        <button
          onClick={handleReset}
          className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Start over
        </button>
      </div>

      {lastSaved && (
        <div className="relative rounded-md border border-emerald-200 bg-emerald-50 p-4 pr-10 text-sm text-emerald-900">
          <button
            type="button"
            onClick={() => setLastSaved(null)}
            className="absolute right-2 top-2 rounded p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
            aria-label="Dismiss last saved session stats"
          >
            ×
          </button>
          <p className="font-medium">Last session saved</p>
          <p className="mt-1 text-emerald-800">
            Stats from your most recent save: duration {formatTypingDuration(lastSaved.durationSec)} · wpm{' '}
            {lastSaved.wpm.toFixed(1)} · accuracy {(lastSaved.accuracy * 100).toFixed(1)}% · errors{' '}
            {lastSaved.errorCount} · chars {lastSaved.charCount} · loops {lastSaved.loopCount}
          </p>
        </div>
      )}
      {submitMutation.isError && (
        <p className="text-sm text-red-600">Failed to save: {(submitMutation.error as Error).message}</p>
      )}
    </div>
  );
}

function StatsBar({
  durationSec,
  wpm,
  accuracy,
  progress,
  errors,
  pass,
}: {
  durationSec: number;
  wpm: number;
  accuracy: number;
  progress: number;
  errors: number;
  pass: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border bg-white p-3 text-sm sm:grid-cols-6">
      <Stat label="time" value={formatTypingDuration(durationSec)} />
      <Stat label="wpm" value={wpm.toFixed(1)} />
      <Stat label="accuracy" value={`${(accuracy * 100).toFixed(1)}%`} />
      <Stat label="progress" value={`${(progress * 100).toFixed(0)}%`} />
      <Stat label="errors" value={String(errors)} />
      <Stat label="pass" value={pass === null ? '—' : String(pass)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="font-mono text-base">{value}</div>
    </div>
  );
}
