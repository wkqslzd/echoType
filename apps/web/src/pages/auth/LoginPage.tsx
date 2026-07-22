import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/AuthProvider';
import { AUTH_FLASH_ERROR_KEY, startGoogleSignIn } from '../../auth/cognitoOAuthExchange';
import { isUserNotFound } from '../../auth/mapCognitoError';
import { PASSWORD_CHANGED_LOGIN_MESSAGE } from '../../auth/passwordMessages';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { GUEST_LOGIN_TOAST, resolvePostLoginPath } from '../../auth/resolvePostLoginPath';

export function LoginPage() {
  const { login, mapError, isUserNotConfirmed } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const verified = params.get('verified') === '1';
  const reset = params.get('reset') === '1';
  const pwset = params.get('pwset') === '1';

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
      // Do not pass Email-field autofill as hintEmail — it blocks Google sign-in for users.
      // L2 link matches on the Google account email server-side; reauth may still pass a hint.
      await startGoogleSignIn(next);
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
      {(reset || pwset) && (
        <p className="mt-2 text-sm text-green-700">{PASSWORD_CHANGED_LOGIN_MESSAGE}</p>
      )}
      <button
        type="button"
        data-testid="auth-google"
        disabled={googleSubmitting || submitting}
        onClick={() => void onGoogleSignIn()}
        className="mt-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 dark:border-serika-border dark:bg-serika-surface dark:text-serika-text dark:hover:bg-serika-raised dark:disabled:opacity-60"
      >
        {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-slate-500 dark:text-serika-sub">
        <span className="h-px flex-1 bg-slate-200 dark:bg-serika-border" />
        <span>or</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-serika-border" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-serika-sub">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-serika-sub">Password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        {showSignUpLink && (
          <p className="text-sm text-slate-600 dark:text-serika-sub">
            <Link to="/register" className="text-slate-900 underline dark:text-serika-text">
              Create an account
            </Link>
          </p>
        )}
        <p className="text-right text-sm">
          <Link to="/forgot-password" className="text-slate-600 underline hover:text-slate-900 dark:text-serika-sub dark:hover:text-serika-text">
            Forgot password?
          </Link>
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-serika-sub">
        No account?{' '}
        <Link to="/register" className="text-slate-900 underline dark:text-serika-text">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
