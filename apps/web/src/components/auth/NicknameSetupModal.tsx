import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NICKNAME_MAX } from '@echotype/shared';
import { useAuth } from '../../auth/AuthProvider';
import { mapCognitoError } from '../../auth/mapCognitoError';
import { validateNickname } from '../../auth/nicknamePolicy';

/** Blocking first-time nickname setup for Google-only signups (G3A). */
export function NicknameSetupModal() {
  const { updateNickname } = useAuth();
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateNickname(nickname);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await updateNickname(nickname);
      await queryClient.invalidateQueries({ queryKey: ['account'] });
    } catch (err) {
      if (err instanceof Error && err.message !== 'not_authed') {
        setError(err.message);
      } else {
        setError(mapCognitoError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="nickname-setup-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-setup-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:border dark:border-serika-border dark:bg-serika-surface">
        <h2 id="nickname-setup-title" className="text-lg font-semibold text-slate-900 dark:text-serika-text">
          Set your nickname
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-serika-sub">
          This name appears in the header and on your practice history. You can change it later
          in Account settings.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Nickname</span>
            <input
              type="text"
              required
              autoFocus
              autoComplete="nickname"
              maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
              data-testid="nickname-setup-input"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
            data-testid="nickname-setup-submit"
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
