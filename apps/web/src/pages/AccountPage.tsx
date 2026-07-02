import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDeleteConfirmationValid, NICKNAME_MAX } from '@echotype/shared';
import { useAuth } from '../auth/AuthProvider';
import {
  ACCOUNT_DELETED_FLASH,
  ACCOUNT_DELETE_COGNITO_FAILED_MESSAGE,
  AccountDeleteCognitoError,
} from '../auth/accountDelete';
import { mapChangePasswordError, mapCognitoError } from '../auth/mapCognitoError';
import { validateNickname } from '../auth/nicknamePolicy';
import { validatePassword } from '../auth/passwordPolicy';
import { api } from '../lib/api';

export function AccountPage() {
  const navigate = useNavigate();
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

  const [loadError, setLoadError] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const deleteReady =
    deletePassword.length > 0 && isDeleteConfirmationValid(deleteConfirm) && !deleteSubmitting;

  useEffect(() => {
    if (status !== 'authed') return;

    let cancelled = false;
    (async () => {
      try {
        const account = await api.getAccount();
        if (cancelled) return;
        setEmail(account.email);
        setNickname(account.name);
        applyDisplayName(account.name);
      } catch {
        if (!cancelled) {
          setLoadError('Could not load account details. Try again later.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, applyDisplayName]);

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
      setNicknameMessage('Nickname updated.');
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
      logout();
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setPasswordError(mapChangePasswordError(err));
    } finally {
      setPasswordSubmitting(false);
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
      if (err instanceof Error && err.message !== 'not_authed') {
        setDeleteError(err.message);
        return;
      }
      setDeleteError(mapChangePasswordError(err));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your sign-in details and nickname.</p>
      </div>

      <section className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Email</h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="account-email">
          {email || '…'}
        </p>
        <p className="mt-1 text-xs text-slate-500">Email cannot be changed yet.</p>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Change nickname</h2>
        <form className="mt-3 space-y-3" onSubmit={onNicknameSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700">Nickname</span>
            <input
              type="text"
              required
              autoComplete="nickname"
              maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          {nicknameError && <p className="text-sm text-red-600">{nicknameError}</p>}
          {nicknameMessage && <p className="text-sm text-green-700">{nicknameMessage}</p>}
          <button
            type="submit"
            disabled={nicknameSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {nicknameSubmitting ? 'Saving…' : 'Save nickname'}
          </button>
        </form>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Change password</h2>
        <form className="mt-3 space-y-3" onSubmit={onPasswordSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700">Current password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">New password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Confirm new password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-green-700">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {passwordSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="rounded-md border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-medium text-red-900">Danger zone</h2>
        <p className="mt-2 text-sm text-red-800">
          Permanently delete your account, courses, collections, and practice history. This
          cannot be undone.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onDeleteSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700">Current password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Type DELETE to confirm</span>
            <input
              type="text"
              required
              autoComplete="off"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              data-testid="account-delete-confirm"
            />
          </label>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
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
