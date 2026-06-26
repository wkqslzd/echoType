export const TIMER_MIN_MINUTES = 10;
export const TIMER_MAX_MINUTES = 120;

export const TIMER_PRESET_MINUTES = [10, 15, 30, 45, 60, 90, 120] as const;

export type TimerDurationValidation =
  | { ok: true; minutes: number }
  | { ok: false; message: string };

/** Map fullwidth digits U+FF10–FF19 to ASCII 0–9. */
function normalizeDigits(raw: string): string {
  return raw.replace(/[\uFF10-\uFF19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}

export function parseTimerMinutesInput(raw: string): TimerDurationValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter a duration between 10 and 120 minutes.' };
  }
  const normalized = normalizeDigits(trimmed);
  if (!/^\d+$/.test(normalized)) {
    return {
      ok: false,
      message: 'Enter a whole number of minutes (10–120). Please use standard digits (0–9).',
    };
  }
  const minutes = Number(normalized);
  if (!Number.isInteger(minutes)) {
    return { ok: false, message: 'Enter a whole number of minutes (10–120).' };
  }
  if (minutes < TIMER_MIN_MINUTES || minutes > TIMER_MAX_MINUTES) {
    return {
      ok: false,
      message: `Duration must be between ${TIMER_MIN_MINUTES} and ${TIMER_MAX_MINUTES} minutes.`,
    };
  }
  return { ok: true, minutes };
}

export function resolveTimedDurationMinutes(
  presetMinutes: number,
  customInput: string,
): TimerDurationValidation {
  const trimmed = customInput.trim();
  if (trimmed) return parseTimerMinutesInput(trimmed);
  if (!TIMER_PRESET_MINUTES.includes(presetMinutes as (typeof TIMER_PRESET_MINUTES)[number])) {
    return { ok: false, message: 'Select a preset duration or enter a custom value.' };
  }
  return { ok: true, minutes: presetMinutes };
}

export function formatCountdown(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function presetLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return '1 h';
  if (minutes === 90) return '1 h 30 min';
  return '2 h';
}
