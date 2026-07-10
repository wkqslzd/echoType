import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/AuthProvider';
import { AUTH_FLASH_ERROR_KEY, startGoogleSignIn } from '../../auth/cognitoOAuthExchange';
import { isUserNotFound } from '../../auth/mapCognitoError';
import { GUEST_LOGIN_TOAST, resolvePostLoginPath } from '../../auth/resolvePostLoginPath';

export function LoginPage() {
  const { login, mapError, isUserNotConfirmed } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/courses/short';
  const verified = params.get('verified') === '1';
  const reset = params.get('reset') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSignUpLink, setShowSignUpLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    const flashError = sessionStorage.getItem(AUTH_FLASH_ERROR_KEY);
    if (!flashError) return;
    sessionStorage.removeItem(AUTH_FLASH_ERROR_KEY);
    setError(flashError);
  }, []);

  async function onGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      // hintEmail is only for linking an existing email account (G4A). Autofill in the
      // Email field must not block brand-new Google sign-up — leave Email empty for that.
      await startGoogleSignIn(next, email.trim() || undefined);
    } catch {
      setError('Google sign-in is not available right now.');
      setGoogleSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowSignUpLink(false);
    setSubmitting(true);
    try {
      await login(email, password);
      const destination = resolvePostLoginPath(next);
      if (destination !== next) {
        sessionStorage.setItem('echotype.auth.flash', GUEST_LOGIN_TOAST);
      }
      navigate(destination, { replace: true });
    } catch (err) {
      if (isUserNotConfirmed(err)) {
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
        return;
      }
      if (isUserNotFound(err)) {
        setShowSignUpLink(true);
        setError('No account found for this email. Sign up instead?');
        return;
      }
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Sign in</h1>
      {verified && (
        <p className="mt-2 text-sm text-green-700">Email verified. You can sign in now.</p>
      )}
      {reset && (
        <p className="mt-2 text-sm text-green-700">Password updated. You can sign in now.</p>
      )}
      <button
        type="button"
        data-testid="auth-google"
        disabled={googleSubmitting || submitting}
        onClick={() => void onGoogleSignIn()}
        className="mt-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      >
        {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        New Google account: leave Email empty. To link an existing email account, fill Email
        first, then continue with that same Google address.
      </p>
      <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {showSignUpLink && (
          <p className="text-sm text-slate-600">
            <Link to="/register" className="text-slate-900 underline">
              Create an account
            </Link>
          </p>
        )}
        <p className="text-right text-sm">
          <Link to="/forgot-password" className="text-slate-600 underline hover:text-slate-900">
            Forgot password?
          </Link>
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        No account?{' '}
        <Link to="/register" className="text-slate-900 underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
