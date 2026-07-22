import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isDeleteConfirmationValid, NICKNAME_MAX } from '@echotype/shared';
import { useAuth } from '../auth/AuthProvider';
import {
  ACCOUNT_DELETED_FLASH,
  ACCOUNT_DELETE_COGNITO_FAILED_MESSAGE,
  AccountDeleteCognitoError,
} from '../auth/accountDelete';
import { loadAuthSession } from '../auth/authSession.js';
import { isOrphanGoogleSession } from '../auth/cognitoOAuthExchange.js';
import { mapChangePasswordError, mapCognitoError } from '../auth/mapCognitoError';
import { validateNickname } from '../auth/nicknamePolicy';
import { validatePassword } from '../auth/passwordPolicy';
import {
  PASSWORD_CHANGE_SIGNOUT_NOTICE,
  PASSWORD_REAUTH_LOGIN_PATH,
} from '../auth/passwordMessages';
import { api } from '../lib/api';
import { PasswordInput } from '../components/auth/PasswordInput';
import { PageError } from '../components/page-status/PageError';
import { PageLoading } from '../components/page-status/PageLoading';

export function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status, applyDisplayName, changePassword, updateNickname, deleteAccount, logout } =
    useAuth();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [canSetPassword, setCanSetPassword] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupPasswordError, setSetupPasswordError] = useState<string | null>(null);
  const [setupPasswordSubmitting, setSetupPasswordSubmitting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const orphanGoogleSession = (() => {
    const session = loadAuthSession();
    return session ? isOrphanGoogleSession(session) : false;
  })();

  const deleteReady = orphanGoogleSession
    ? isDeleteConfirmationValid(deleteConfirm) && !deleteSubmitting
    : deletePassword.length > 0 &&
      isDeleteConfirmationValid(deleteConfirm) &&
      !deleteSubmitting;

  useEffect(() => {
    if (status !== 'authed') return;

    let cancelled = false;
    (async () => {
      setAccountLoading(true);
      setLoadError(null);
      try {
        const account = await api.getAccount();
        if (cancelled) return;
        setEmail(account.email);
        setNickname(account.name);
        setCanSetPassword(account.canSetPassword);
        applyDisplayName(account.name);
      } catch {
        if (!cancelled) {
          setLoadError('Could not load account details. Try again later.');
        }
      } finally {
        if (!cancelled) {
          setAccountLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, applyDisplayName]);

  function retryLoadAccount() {
    if (status !== 'authed') return;
    setAccountLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const account = await api.getAccount();
        setEmail(account.email);
        setNickname(account.name);
        setCanSetPassword(account.canSetPassword);
        applyDisplayName(account.name);
      } catch {
        setLoadError('Could not load account details. Try again later.');
      } finally {
        setAccountLoading(false);
      }
    })();
  }

  async function onNicknameSubmit(e: FormEvent) {
    e.preventDefault();
    setNicknameMessage(null);
    setNicknameError(null);

    const validationError = validateNickname(nickname);
    if (validationError) {
      setNicknameError(validationError);
      return;
    }

    setNicknameSubmitting(true);
    try {
      const account = await updateNickname(nickname);
      setNickname(account.name);
      await queryClient.invalidateQueries({ queryKey: ['account'] });
      setNicknameMessage('Nickname saved.');
    } catch (err) {
      if (err instanceof Error && err.message !== 'not_authed') {
        setNicknameError(err.message);
      } else {
        setNicknameError(mapCognitoError(err));
      }
    } finally {
      setNicknameSubmitting(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    const passwordValidation = validatePassword(newPassword);
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      // Same re-auth path as set-password: Hosted UI logout would bounce to `/`.
      logout({ clearHostedUi: false });
      navigate(PASSWORD_REAUTH_LOGIN_PATH, { replace: true });
    } catch (err) {
      setPasswordError(mapChangePasswordError(err));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function onSetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setSetupPasswordError(null);

    const validationError = validatePassword(setupPassword);
    if (validationError) {
      setSetupPasswordError(validationError);
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setSetupPasswordError('Passwords do not match.');
      return;
    }

    setSetupPasswordSubmitting(true);
    try {
      await api.setPassword(setupPassword);
      // Tokens belong to the deleted federated user. Clear the local session
      // without Hosted UI logout (that would bounce to `/` and drop ?pwset=1).
      logout({ clearHostedUi: false });
      navigate(PASSWORD_REAUTH_LOGIN_PATH, { replace: true });
    } catch {
      setSetupPasswordError('Could not set password. Try again later.');
    } finally {
      setSetupPasswordSubmitting(false);
    }
  }

  async function onDeleteSubmit(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    if (!isDeleteConfirmationValid(deleteConfirm)) {
      setDeleteError('Type DELETE to confirm account deletion.');
      return;
    }

    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePassword, deleteConfirm);
      sessionStorage.setItem('echotype.auth.flash', ACCOUNT_DELETED_FLASH);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AccountDeleteCognitoError) {
        setDeleteError(ACCOUNT_DELETE_COGNITO_FAILED_MESSAGE);
        return;
      }
      // Map before the raw-message fallback: Cognito's own text says
      // "Incorrect username or password." but this form only asks for a password.
      if ((err as { name?: string } | null)?.name === 'NotAuthorizedException') {
        setDeleteError(mapChangePasswordError(err));
        return;
      }
      if (err instanceof Error && err.message !== 'not_authed') {
        setDeleteError(err.message);
        return;
      }
      setDeleteError(mapChangePasswordError(err));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (accountLoading) {
    return <PageLoading label="Loading account…" />;
  }

  if (loadError) {
    return (
      <PageError
        title="Could not load account"
        description={loadError}
        onRetry={retryLoadAccount}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-serika-sub">Manage your sign-in details and nickname.</p>
      </div>

      <section className="rounded-md border bg-white p-4 dark:border-serika-border dark:bg-serika-surface">
        <h2 className="text-sm font-medium text-slate-900 dark:text-serika-text">Email</h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-serika-sub" data-testid="account-email">
          {email || '…'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-serika-sub">Email cannot be changed yet.</p>
      </section>

      <section className="rounded-md border bg-white p-4 dark:border-serika-border dark:bg-serika-surface">
        <h2 className="text-sm font-medium text-slate-900 dark:text-serika-text">Change nickname</h2>
        <form className="mt-3 space-y-3" onSubmit={onNicknameSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Nickname</span>
            <input
              type="text"
              required
              autoComplete="nickname"
              maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
            />
          </label>
          {nicknameError && <p className="text-sm text-red-600 dark:text-red-300">{nicknameError}</p>}
          {nicknameMessage && <p className="text-sm text-green-700">{nicknameMessage}</p>}
          <button
            type="submit"
            disabled={nicknameSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
          >
            {nicknameSubmitting ? 'Saving…' : 'Save nickname'}
          </button>
        </form>
      </section>

      {canSetPassword ? (
        <section className="rounded-md border bg-white p-4 dark:border-serika-border dark:bg-serika-surface">
          <h2 className="text-sm font-medium text-slate-900 dark:text-serika-text">Set a password</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-serika-sub">
            Add a password so you can also sign in with your email.
          </p>
          <form className="mt-3 space-y-3" onSubmit={onSetPasswordSubmit}>
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-serika-sub">Password</span>
              <PasswordInput
                value={setupPassword}
                onChange={setSetupPassword}
                autoComplete="new-password"
              />
              <span className="mt-1 block text-xs text-slate-500 dark:text-serika-sub">
                At least 8 characters with uppercase, lowercase, and a number.
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700 dark:text-serika-sub">Confirm password</span>
              <PasswordInput
                value={setupPasswordConfirm}
                onChange={setSetupPasswordConfirm}
                autoComplete="new-password"
              />
            </label>
            {setupPasswordError && <p className="text-sm text-red-600 dark:text-red-300">{setupPasswordError}</p>}
            <button
              type="submit"
              disabled={setupPasswordSubmitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
            >
              {setupPasswordSubmitting ? 'Saving…' : 'Save password'}
            </button>
            <p className="text-xs text-red-600 dark:text-red-300">{PASSWORD_CHANGE_SIGNOUT_NOTICE}</p>
          </form>
        </section>
      ) : (
      <section className="rounded-md border bg-white p-4 dark:border-serika-border dark:bg-serika-surface">
        <h2 className="text-sm font-medium text-slate-900 dark:text-serika-text">Change password</h2>
        <form className="mt-3 space-y-3" onSubmit={onPasswordSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Current password</span>
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">New password</span>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Confirm new password</span>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </label>
          {passwordError && <p className="text-sm text-red-600 dark:text-red-300">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-green-700">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50] dark:disabled:border-serika-border dark:disabled:bg-transparent dark:disabled:text-serika-sub dark:disabled:opacity-100"
          >
            {passwordSubmitting ? 'Updating…' : 'Update password'}
          </button>
          <p className="text-xs text-red-600 dark:text-red-300">{PASSWORD_CHANGE_SIGNOUT_NOTICE}</p>
        </form>
      </section>
      )}

      <section className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="text-sm font-medium text-red-900 dark:text-red-300">Danger zone</h2>
        <p className="mt-2 text-sm text-red-800 dark:text-red-300">
          Permanently delete your account, courses, collections, and practice history. This
          cannot be undone.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onDeleteSubmit}>
          {!orphanGoogleSession && (
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Current password</span>
            <PasswordInput
              value={deletePassword}
              onChange={setDeletePassword}
              autoComplete="current-password"
            />
          </label>
          )}
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-serika-sub">Type DELETE to confirm</span>
            <input
              type="text"
              required
              autoComplete="off"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
              data-testid="account-delete-confirm"
            />
          </label>
          {deleteError && <p className="text-sm text-red-600 dark:text-red-300">{deleteError}</p>}
          <button
            type="submit"
            disabled={!deleteReady}
            className="rounded-md border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            data-testid="account-delete-submit"
          >
            {deleteSubmitting ? 'Deleting…' : 'Delete account'}
          </button>
        </form>
      </section>
    </div>
  );
}
