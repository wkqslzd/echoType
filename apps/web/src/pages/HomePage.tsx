import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCOUNT_DELETED_FLASH } from '../auth/accountDelete';
import {
  AUTH_FLASH_ERROR_KEY,
  clearConsumedStaleSessionRetry,
  consumeStaleSessionRetryOnce,
  startGoogleSignIn,
} from '../auth/cognitoOAuthExchange';
import { PracticeSummary } from '../components/PracticeSummary';
import { PageLoading } from '../components/page-status/PageLoading';

export function HomePage() {
  const [flash, setFlash] = useState<string | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  // Memoized consume: Strict Mode double-invokes this initializer and keeps
  // the second result, so a raw one-shot read would lose the marker.
  const [staleSessionRetry] = useState(() => consumeStaleSessionRetryOnce());

  useLayoutEffect(() => {
    if (!staleSessionRetry) return;
    void startGoogleSignIn(staleSessionRetry.nextPath, staleSessionRetry.hintEmail, {
      autoReuse: true,
    }).catch(() => {
      sessionStorage.setItem(
        AUTH_FLASH_ERROR_KEY,
        'Google sign-in is not available right now. Try again.',
      );
      window.location.replace('/');
    });
    // Retry acted on — drop the memo so an SPA remount before the redirect
    // lands falls back to the normal home page instead of the retry spinner.
    clearConsumedStaleSessionRetry();
  }, [staleSessionRetry]);

  useEffect(() => {
    const error = sessionStorage.getItem(AUTH_FLASH_ERROR_KEY);
    if (error) {
      sessionStorage.removeItem(AUTH_FLASH_ERROR_KEY);
      setFlashError(error);
    }
    const message = sessionStorage.getItem('echotype.auth.flash');
    if (message) {
      sessionStorage.removeItem('echotype.auth.flash');
      setFlash(message);
    }
  }, []);

  if (staleSessionRetry) {
    return <PageLoading label="Refreshing your Google sign-in…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to echoType</h1>
        <p className="mt-2 text-slate-600">
          Type, repeat, and remember meaningful texts with your own annotations.
        </p>
        {flashError && (
          <p className="mt-3 text-sm text-red-600" data-testid="home-auth-flash-error">
            {flashError}{' '}
            <Link to="/login" className="underline">
              Back to sign in
            </Link>
          </p>
        )}
        {flash && (
          <p className="mt-3 text-sm text-green-700" data-testid="home-auth-flash">
            {flash}
          </p>
        )}
        {flash === ACCOUNT_DELETED_FLASH && (
          <p className="mt-2 text-sm text-slate-600">
            <Link to="/register" className="text-slate-900 underline">
              Create a new account
            </Link>
          </p>
        )}
      </div>

      <PracticeSummary />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/courses/short"
          className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-slate-900">Short mode</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quotes, short poems, and self-contained passages you want to repeat quickly.
          </p>
        </Link>
        <Link
          to="/courses/article"
          className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-slate-900">Article mode</h2>
          <p className="mt-2 text-sm text-slate-600">
            Full speeches, essays, and longer passages for sustained practice.
          </p>
        </Link>
      </div>
    </div>
  );
}
