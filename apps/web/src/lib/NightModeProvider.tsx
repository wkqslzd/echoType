import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSystemDark,
  readNightModePreference,
  resolveNightMode,
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
  /** When false (non-typing routes), never apply `dark` on the document. */
  active: boolean;
  children: ReactNode;
};

export function NightModeProvider({ active, children }: NightModeProviderProps) {
  const [preference, setPreference] = useState<NightModePreference>(readNightModePreference);
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effectiveNight = resolveNightMode(preference, systemDark);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (active && effectiveNight) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return () => {
      root.classList.remove('dark');
    };
  }, [active, effectiveNight]);

  const setNightEnabled = useCallback((enabled: boolean) => {
    const next: NightModePreference = enabled ? '1' : '0';
    writeNightModePreference(next);
    setPreference(next);
  }, []);

  const clearToSystem = useCallback(() => {
    writeNightModePreference(null);
    setPreference(null);
  }, []);

  const value = useMemo<NightModeContextValue>(
    () => ({
      effectiveNight: active && effectiveNight,
      preference,
      hasOverride: preference !== null,
      setNightEnabled,
      clearToSystem,
    }),
    [active, effectiveNight, preference, setNightEnabled, clearToSystem],
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
