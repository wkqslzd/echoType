import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/AuthProvider';
import { validatePassword } from '../../auth/passwordPolicy';

export function ResetPasswordPage() {
  const { confirmPasswordReset, mapError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email')?.trim() ?? '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!email) {
    return (
      <AuthLayout>
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-serika-sub">Enter your email on the previous step first.</p>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-slate-900 underline dark:text-serika-text">
            Request a code
          </Link>
        </p>
      </AuthLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(email, code, password);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-serika-sub">
        Enter the verification code sent to <span className="font-medium dark:text-serika-text">{email}</span>.
      </p>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-serika-sub">Verification code</span>
          <input
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-serika-sub">New password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-serika-sub">Confirm new password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-serika-sub">
        <Link to="/forgot-password" className="text-slate-900 underline dark:text-serika-text">
          Resend code
        </Link>
        {' · '}
        <Link to="/login" className="text-slate-900 underline dark:text-serika-text">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
