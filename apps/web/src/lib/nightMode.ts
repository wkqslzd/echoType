/** Typing-session Night mode preference (local only; not synced to account). */
export const NIGHT_MODE_STORAGE_KEY = 'echotype-night-mode';

/** Explicit override: `'1'` force on, `'0'` force off, `null` follow browser prefers-color-scheme. */
export type NightModePreference = '1' | '0' | null;

export function resolveNightMode(
  preference: NightModePreference,
  /** Browser-reported dark preference (`prefers-color-scheme`), not raw OS. */
  browserPrefersDark: boolean,
): boolean {
  if (preference === '1') return true;
  if (preference === '0') return false;
  return browserPrefersDark;
}

export function readNightModePreference(): NightModePreference {
  try {
    const value = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
    if (value === '1' || value === '0') return value;
    return null;
  } catch {
    return null;
  }
}

export function writeNightModePreference(preference: NightModePreference): void {
  try {
    if (preference === null) {
      localStorage.removeItem(NIGHT_MODE_STORAGE_KEY);
    } else {
      localStorage.setItem(NIGHT_MODE_STORAGE_KEY, preference);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  // Browser color-scheme preference (Chrome Appearance may override OS).
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
