import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/AuthProvider';
import { isUserNotConfirmed } from '../../auth/mapCognitoError';

export function ForgotPasswordPage() {
  const { requestPasswordReset, mapError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (err) {
      if (isUserNotConfirmed(err)) {
        setUnconfirmedEmail(email.trim());
        setError('Confirm your email before resetting your password.');
        return;
      }
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-serika-sub">
        Enter your account email. We will send a verification code to reset your password.
      </p>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
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
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        {unconfirmedEmail && (
          <p className="text-sm text-slate-600 dark:text-serika-sub">
            <Link
              to={`/verify-email?email=${encodeURIComponent(unconfirmedEmail)}`}
              className="text-slate-900 underline dark:text-serika-text"
            >
              Verify your email
            </Link>
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
        >
          {submitting ? 'Sending…' : 'Send verification code'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-serika-sub">
        <Link to="/login" className="text-slate-900 underline dark:text-serika-text">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
