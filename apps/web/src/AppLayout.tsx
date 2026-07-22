import { useEffect, useLayoutEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { useOnboardingSeed } from './auth/useOnboardingSeed';
import { loginPathWithNext } from './auth/publicPaths';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { logRouteScrollMonitor, scrollRouteToTop } from './lib/routeScroll';
import { NicknameSetupModal } from './components/auth/NicknameSetupModal';
import { NightModeProvider } from './lib/NightModeProvider';
import { api } from './lib/api';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { displayName, logout, status } = useAuth();

  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: () => api.getAccount(),
    enabled: status === 'authed',
    staleTime: 30_000,
  });

  useOnboardingSeed();

  useLayoutEffect(() => {
    scrollRouteToTop();
    logRouteScrollMonitor(location.pathname, 'layout');
    const frame = requestAnimationFrame(() => {
      scrollRouteToTop();
      logRouteScrollMonitor(location.pathname, 'rAF');
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname]);

  useEffect(() => {
    scrollRouteToTop();
    logRouteScrollMonitor(location.pathname, 'effect');
    const t = window.setTimeout(() => {
      scrollRouteToTop();
      logRouteScrollMonitor(location.pathname, 't+0ms');
    }, 0);
    const tLate = window.setTimeout(() => {
      logRouteScrollMonitor(location.pathname, 't+100ms');
    }, 100);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(tLate);
    };
  }, [location.key, location.pathname]);

  function onLogout() {
    if (!logout()) {
      navigate('/login', { replace: true });
    }
  }

  const isTypingPage = /\/type$/.test(location.pathname);
  // Light shell stays bg-white (there is no serika-shell token). Dark uses serika-bg #2c2e31.

  const showNicknameSetup = status === 'authed' && account?.needsNicknameSetup;

  return (
    <NightModeProvider active={isTypingPage}>
      <div
        className="flex min-h-dvh flex-col bg-white dark:bg-serika-bg"
        data-testid={isTypingPage ? 'typing-session-shell' : 'app-shell'}
      >
        {showNicknameSetup && <NicknameSetupModal />}
        <SiteHeader
          className="shrink-0"
          trailing={
            status === 'authed' ? (
              <>
                {displayName && (
                  <Link
                    to="/account"
                    className="text-sm text-slate-600 underline hover:text-slate-900 dark:text-serika-text dark:hover:text-serika-text"
                    data-testid="auth-display-name"
                  >
                    {displayName}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-sm text-slate-600 hover:text-slate-900 dark:text-serika-text dark:hover:text-serika-text"
                  data-testid="auth-logout"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                to={loginPathWithNext(location.pathname + location.search)}
                className="text-sm font-medium text-slate-900 hover:underline dark:text-serika-text"
                data-testid="auth-login"
              >
                Log in
              </Link>
            )
          }
        />
        <main
          className={
            isTypingPage
              ? 'mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto px-4 py-4 text-slate-900 dark:text-slate-400'
              : 'mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 dark:text-serika-text'
          }
        >
          <Outlet />
        </main>
        {!isTypingPage && <SiteFooter />}
      </div>
    </NightModeProvider>
  );
}
