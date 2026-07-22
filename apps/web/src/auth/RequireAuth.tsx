import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.js';
import { loginPathWithNext } from './publicPaths.js';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-serika-sub">
        Loading…
      </div>
    );
  }

  if (status === 'guest') {
    return <Navigate to={loginPathWithNext(location.pathname + location.search)} replace />;
  }

  return <>{children}</>;
}
