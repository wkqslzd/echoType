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

  const showNicknameSetup = status === 'authed' && account?.needsNicknameSetup;

  return (
    <div className="flex min-h-dvh flex-col">
      {showNicknameSetup && <NicknameSetupModal />}
      <SiteHeader className="shrink-0" trailing={
          status === 'authed' ? (
            <>
              {displayName && (
                <Link
                  to="/account"
                  className="text-sm text-slate-600 underline hover:text-slate-900"
                  data-testid="auth-display-name"
                >
                  {displayName}
                </Link>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="text-sm text-slate-600 hover:text-slate-900"
                data-testid="auth-logout"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to={loginPathWithNext(location.pathname + location.search)}
              className="text-sm font-medium text-slate-900 hover:underline"
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
            ? 'mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto px-4 py-4'
            : 'mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6'
        }
      >
        <Outlet />
      </main>
      {!isTypingPage && <SiteFooter />}
    </div>
  );
}
