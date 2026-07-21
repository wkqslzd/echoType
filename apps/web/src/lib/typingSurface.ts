/** Shared visual tokens for passage + typing textarea (parallel surfaces). */
export const TYPING_SURFACE_BASE =
  'rounded-md bg-white p-4 font-mono text-base leading-relaxed dark:bg-serika-surface dark:text-serika-sub';

/** Framed surface (border). Used by the visible textarea and default AnnotatedText. */
export const TYPING_SURFACE_CLASS = `${TYPING_SURFACE_BASE} border dark:border-serika-border`;

/** Two lines of leading-relaxed text-base plus vertical padding (p-4). */
export const TYPING_TEXTAREA_CLASS = `${TYPING_SURFACE_CLASS} h-[calc(2*1.625rem+2rem)] w-full resize-none overflow-y-auto whitespace-pre-wrap break-words text-slate-900 focus:border-slate-500 focus:outline-none dark:text-serika-sub dark:focus:border-serika-border`;

/**
 * Visually hidden but focusable. Positioned via JS over the passage typing cursor
 * (see positionImmersiveTextareaAtCursor) so pinch-zoom caret scroll-into-view
 * does not pan to the input panel. Containing block: input panel `relative`.
 */
export const TYPING_TEXTAREA_IMMERSIVE_CLASS =
  'pointer-events-none absolute h-px w-px resize-none overflow-hidden opacity-0 border-0 p-0';

export const IMMERSIVE_MODE_STORAGE_KEY = 'echotype-immersive-mode';

/** When `'1'`, forgiving alignment (ignore space/punct/case) is enabled on the typing page. */
export const FORGIVING_MODE_STORAGE_KEY = 'echotype-forgiving-mode';

/** When `'1'`, idle session-timer control is hidden until user restores it. */
export const SESSION_TIMER_HIDDEN_STORAGE_KEY = 'echotype-session-timer-hidden';

export function readSessionTimerHiddenPreference(): boolean {
  try {
    return localStorage.getItem(SESSION_TIMER_HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSessionTimerHiddenPreference(hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(SESSION_TIMER_HIDDEN_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_TIMER_HIDDEN_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readForgivingModePreference(): boolean {
  try {
    return localStorage.getItem(FORGIVING_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeForgivingModePreference(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(FORGIVING_MODE_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(FORGIVING_MODE_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/** Whole-second duration as minutes:seconds (e.g. 0:07, 2:05). */
export function formatTypingDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
