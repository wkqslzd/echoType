import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import {
  completeOAuthCallbackOnce,
  startGoogleSignIn,
} from '../../auth/cognitoOAuthExchange';
import { GUEST_LOGIN_TOAST } from '../../auth/resolvePostLoginPath';
import { PageLoading } from '../../components/page-status/PageLoading';

type CallbackPhase = 'completing' | 'reauth' | 'error';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<CallbackPhase>('completing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void completeOAuthCallbackOnce({
      oauthError: params.get('error'),
      code: params.get('code'),
      state: params.get('state'),
    }).then((outcome) => {
      if (cancelled) return;

      if (outcome.kind === 'error') {
        setError(outcome.message);
        setPhase('error');
        return;
      }

      if (outcome.kind === 'reauth') {
        setPhase('reauth');
        void startGoogleSignIn(outcome.nextPath);
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
        <p className="mt-3 text-sm text-red-600" data-testid="auth-callback-error">
          {error}
        </p>
        <p className="mt-4 text-sm">
          <Link to="/login" className="text-slate-900 underline">
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
