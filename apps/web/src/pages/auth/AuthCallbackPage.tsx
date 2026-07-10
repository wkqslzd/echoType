import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import { completeOAuthCallbackOnce } from '../../auth/cognitoOAuthExchange';
import { GUEST_LOGIN_TOAST } from '../../auth/resolvePostLoginPath';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void completeOAuthCallbackOnce({
      oauthError: params.get('error'),
      code: params.get('code'),
      state: params.get('state'),
    }).then((outcome) => {
      if (outcome.kind === 'error') {
        setError(outcome.message);
        return;
      }
      if (outcome.flashGuest) {
        sessionStorage.setItem('echotype.auth.flash', GUEST_LOGIN_TOAST);
      }
      window.location.assign(outcome.destination);
    });
  }, [params]);

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Signing in…</h1>
      {error ? (
        <>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <p className="mt-4 text-sm">
            <Link to="/login" className="text-slate-900 underline">
              Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Completing Google sign-in…</p>
      )}
    </AuthLayout>
  );
}
