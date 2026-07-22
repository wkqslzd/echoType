/** Typing-session Night mode preference (tab memory only; not synced to account). */
export const NIGHT_MODE_STORAGE_KEY = 'echotype-night-mode';

/** Explicit override: `'1'` force on, `'0'` force off, `null` follow browser prefers-color-scheme. */
export type NightModePreference = '1' | '0' | null;

type PreferenceListener = (preference: NightModePreference) => void;

const preferenceListeners = new Set<PreferenceListener>();

/** In-tab memory only — survives SPA navigations; cleared on full reload / new tab. */
let memoryPreference: NightModePreference = null;

let legacyLocalStorageCleared = false;

/**
 * One-shot: drop ADR-0033 permanent localStorage pin without loading it into memory.
 * Old users follow the browser again after refresh.
 */
export function clearLegacyNightModeLocalStorage(): void {
  if (legacyLocalStorageCleared) return;
  legacyLocalStorageCleared = true;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(NIGHT_MODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Subscribe to preference writes (DocumentDark + NightModeProvider). */
export function subscribeNightModePreference(listener: PreferenceListener): () => void {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

function notifyPreferenceListeners(preference: NightModePreference): void {
  for (const listener of preferenceListeners) {
    listener(preference);
  }
}

/**
 * Sole rule for `html.dark` (DocumentDarkProvider).
 * Typing override applies only on `/…/type`; elsewhere follow the browser.
 */
export function resolveDocumentDark(
  isTypingPath: boolean,
  preference: NightModePreference,
  browserPrefersDark: boolean,
): boolean {
  if (isTypingPath && preference !== null) {
    return preference === '1';
  }
  return browserPrefersDark;
}

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
  clearLegacyNightModeLocalStorage();
  return memoryPreference;
}

/** Update in-memory override only (no localStorage / sessionStorage writes). */
export function writeNightModePreference(preference: NightModePreference): void {
  clearLegacyNightModeLocalStorage();
  memoryPreference = preference;
  notifyPreferenceListeners(preference);
}

/** Test helper — reset module memory between unit tests. */
export function resetNightModePreferenceForTests(): void {
  memoryPreference = null;
  legacyLocalStorageCleared = false;
}

export function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  // Browser color-scheme preference (Chrome Appearance may override OS).
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Typing session routes end with `/type`. */
export function isTypingPathname(pathname: string): boolean {
  return /\/type$/.test(pathname);
}
