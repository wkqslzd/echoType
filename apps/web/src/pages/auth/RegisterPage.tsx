import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EMAIL_ALREADY_EXISTS_MESSAGE } from '@echotype/shared';
import { AuthLayout } from '../../auth/AuthLayout.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { validatePassword } from '../../auth/passwordPolicy.js';
import { api } from '../../lib/api.js';

export function RegisterPage() {
  const { register, mapError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nickname.trim()) {
      setError('Nickname is required.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      const status = await api.checkEmailStatus(email);
      if (!status.available) {
        setError(status.message || EMAIL_ALREADY_EXISTS_MESSAGE);
        return;
      }

      await register(email, password, nickname);
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Email, password, and nickname are all required.
      </p>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
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
          <span className="text-slate-700">Nickname</span>
          <input
            type="text"
            required
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-500">
            At least 8 characters with uppercase, lowercase, and a number.
          </span>
        </label>
        {error && (
          <p className="text-sm text-red-600 whitespace-pre-line" role="alert">
            {error}
          </p>
        )}
        <p className="text-xs text-slate-500">
          By creating an account, you agree to our{' '}
          <Link to="/privacy" className="text-slate-700 underline hover:text-slate-900">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
