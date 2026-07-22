import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthProvider.js';

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-serika-sub">
        Loading…
      </div>
    );
  }

  if (status === 'authed') {
    return <Navigate to={next.startsWith('/') ? next : '/'} replace />;
  }

  return <>{children}</>;
}
