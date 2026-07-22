import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  clearLegacyNightModeLocalStorage,
  getSystemDark,
  isTypingPathname,
  readNightModePreference,
  resolveDocumentDark,
  subscribeNightModePreference,
  type NightModePreference,
} from './nightMode';

/**
 * Sole writer of `html.dark` for the app (App + Auth under RootLayout).
 * Typing Night override is honored only on `/…/type`; see resolveDocumentDark.
 * Override lives in module memory (C1-memory), not localStorage.
 */
export function DocumentDarkProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [preference, setPreference] = useState<NightModePreference>(() => {
    clearLegacyNightModeLocalStorage();
    return readNightModePreference();
  });
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useLayoutEffect(() => {
    clearLegacyNightModeLocalStorage();
    return subscribeNightModePreference(setPreference);
  }, []);

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isTyping = isTypingPathname(pathname);
  const effectiveDark = resolveDocumentDark(isTyping, preference, systemDark);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (effectiveDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Do not remove('dark') on cleanup — that raced site dark when NightMode owned html.
  }, [effectiveDark]);

  return children;
}
