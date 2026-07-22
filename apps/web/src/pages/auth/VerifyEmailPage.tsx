import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout.js';
import { useAuth } from '../../auth/AuthProvider.js';

export function VerifyEmailPage() {
  const { confirmEmail, resendCode, mapError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email')?.trim() ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError('Email is missing. Start from the registration page.');
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await confirmEmail(email, code);
      navigate(`/login?verified=1&email=${encodeURIComponent(email)}`, { replace: true });
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!email) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendCode(email);
      setInfo('A new verification code was sent.');
    } catch (err) {
      setError(mapError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Verify your email</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-serika-sub">
        Enter the code we sent to {email || 'your email'}.
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
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm tracking-widest dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button
          type="submit"
          disabled={submitting || !email}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
        >
          {submitting ? 'Verifying…' : 'Verify email'}
        </button>
      </form>
      <button
        type="button"
        onClick={onResend}
        disabled={resending || !email}
        className="mt-3 w-full text-sm text-slate-600 underline disabled:opacity-60 dark:text-serika-sub dark:hover:text-serika-text"
      >
        {resending ? 'Sending…' : 'Resend code'}
      </button>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-serika-sub">
        <Link to="/login" className="text-slate-900 underline dark:text-serika-text">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
