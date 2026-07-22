import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSystemDark,
  readNightModePreference,
  resolveNightMode,
  subscribeNightModePreference,
  writeNightModePreference,
  type NightModePreference,
} from './nightMode';

type NightModeContextValue = {
  /** Whether the typing session shell should use Night appearance. */
  effectiveNight: boolean;
  /** Stored override; null means follow browser prefers-color-scheme. */
  preference: NightModePreference;
  /** True when an explicit override is stored. */
  hasOverride: boolean;
  /** Toggle: write override to the opposite of current effective. */
  setNightEnabled: (enabled: boolean) => void;
  /** Clear override and follow browser prefers-color-scheme again. */
  clearToSystem: () => void;
};

const NightModeContext = createContext<NightModeContextValue | null>(null);

type NightModeProviderProps = {
  /** When false, effectiveNight is forced off for consumers (non-typing routes). */
  active: boolean;
  children: ReactNode;
};

/**
 * Typing Night preference + switch UI only (C1-memory: module state via nightMode.ts).
 * Does NOT write `html.dark` — DocumentDarkProvider is the sole writer.
 * Does NOT write localStorage / sessionStorage for the override.
 */
export function NightModeProvider({ active, children }: NightModeProviderProps) {
  const [preference, setPreference] = useState<NightModePreference>(readNightModePreference);
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    return subscribeNightModePreference(setPreference);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveNightMode(preference, systemDark);

  const setNightEnabled = useCallback((enabled: boolean) => {
    writeNightModePreference(enabled ? '1' : '0');
  }, []);

  const clearToSystem = useCallback(() => {
    writeNightModePreference(null);
  }, []);

  const value = useMemo<NightModeContextValue>(
    () => ({
      effectiveNight: active && resolved,
      preference,
      hasOverride: preference !== null,
      setNightEnabled,
      clearToSystem,
    }),
    [active, resolved, preference, setNightEnabled, clearToSystem],
  );

  return <NightModeContext.Provider value={value}>{children}</NightModeContext.Provider>;
}

export function useNightMode(): NightModeContextValue {
  const ctx = useContext(NightModeContext);
  if (!ctx) {
    throw new Error('useNightMode must be used within NightModeProvider');
  }
  return ctx;
}
