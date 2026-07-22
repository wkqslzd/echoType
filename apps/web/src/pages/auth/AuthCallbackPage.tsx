import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import {
  completeOAuthCallbackOnce,
  redirectToHostedUiLogout,
  saveStaleSessionRetry,
  shouldClearHostedUiAfterCallbackError,
  startGoogleSignIn,
} from '../../auth/cognitoOAuthExchange';
import { GUEST_LOGIN_TOAST } from '../../auth/resolvePostLoginPath';
import { PageLoading } from '../../components/page-status/PageLoading';

type CallbackPhase = 'completing' | 'reauth' | 'error';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<CallbackPhase>('completing');
  const [error, setError] = useState<string | null>(null);
  const reauthStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const oauthError = params.get('error');
    const code = params.get('code');
    const state = params.get('state');

    if (code || oauthError) {
      window.history.replaceState({}, document.title, '/auth/callback');
    }

    void completeOAuthCallbackOnce({
      oauthError,
      code,
      state,
    }).then((outcome) => {
      if (cancelled) return;

      if (outcome.kind === 'stale_session_retry') {
        saveStaleSessionRetry({
          nextPath: outcome.nextPath,
          hintEmail: outcome.hintEmail,
          createdAt: Date.now(),
        });
        // This existing path calls clearPendingOAuth(), so REAUTH_COUNT is zero
        // before HomePage starts the automatic retry after Cognito logout.
        redirectToHostedUiLogout('/');
        return;
      }

      if (outcome.kind === 'error') {
        if (shouldClearHostedUiAfterCallbackError(outcome.message)) {
          redirectToHostedUiLogout('/login', outcome.message);
          return;
        }
        setError(outcome.message);
        setPhase('error');
        return;
      }

      if (outcome.kind === 'reauth') {
        if (reauthStartedRef.current) return;
        reauthStartedRef.current = true;
        setPhase('reauth');
        void startGoogleSignIn(outcome.nextPath, outcome.hintEmail, { autoReuse: true });
        return;
      }

      if (outcome.flashGuest) {
        sessionStorage.setItem('echotype.auth.flash', GUEST_LOGIN_TOAST);
      }
      window.location.assign(outcome.destination);
    });

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (phase === 'error') {
    return (
      <AuthLayout>
        <h1 className="text-xl font-semibold">Sign-in failed</h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-300" data-testid="auth-callback-error">
          {error}
        </p>
        <p className="mt-4 text-sm">
          <Link to="/login" className="text-slate-900 underline dark:text-serika-text">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  const loadingLabel =
    phase === 'reauth'
      ? 'Linking your Google account… Redirecting to Google to finish sign-in.'
      : 'Completing Google sign-in…';

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Signing in…</h1>
      <div
        className="mt-3"
        data-testid={phase === 'reauth' ? 'auth-callback-reauth' : 'auth-callback-loading'}
      >
        <PageLoading label={loadingLabel} />
      </div>
    </AuthLayout>
  );
}
