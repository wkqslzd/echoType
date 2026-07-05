/** Shared visual tokens for passage + typing textarea (parallel surfaces). */
export const TYPING_SURFACE_CLASS =
  'rounded-md border bg-white p-4 font-mono text-base leading-relaxed';

/** Two lines of leading-relaxed text-base plus vertical padding (p-4). */
export const TYPING_TEXTAREA_CLASS = `${TYPING_SURFACE_CLASS} h-[calc(2*1.625rem+2rem)] w-full resize-none overflow-y-auto whitespace-pre-wrap break-words text-slate-900 focus:border-slate-500 focus:outline-none`;

/** Visually hidden but focusable — anchored in typing panel, not viewport-fixed. */
export const TYPING_TEXTAREA_IMMERSIVE_CLASS =
  'pointer-events-none absolute left-0 top-0 h-px w-px resize-none overflow-hidden opacity-0 border-0 p-0';

export const IMMERSIVE_MODE_STORAGE_KEY = 'echotype-immersive-mode';

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

/** Whole-second duration as minutes:seconds (e.g. 0:07, 2:05). */
export function formatTypingDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
