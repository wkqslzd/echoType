import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AccountDTO } from '@echotype/shared';
import { isDeleteConfirmationValid } from '@echotype/shared';
import { api, ApiError } from '../lib/api.js';
import { AccountDeleteCognitoError } from './accountDelete.js';
import {
  clearAuthSession,
  getDisplayName,
  getSessionEmail,
  getValidAccessToken,
  loadAuthSession,
  persistCognitoSession,
} from './authSession.js';
import { isOrphanGoogleSession, logoutWithHostedUiClear } from './cognitoOAuthExchange.js';
import {
  changePassword as cognitoChangePassword,
  confirmSignUp,
  confirmForgotPassword,
  deleteCognitoAccount,
  forgotPassword,
  resendConfirmationCode,
  signIn,
  signUp,
  sessionToTokens,
  refreshCognitoSession,
} from './cognitoClient.js';
import { isUserNotConfirmed, mapCognitoError } from './mapCognitoError.js';
import { validateNickname } from './nicknamePolicy.js';
import { jwtExpirySeconds } from './jwtPayload.js';

export type AuthStatus = 'loading' | 'guest' | 'authed';

export type AuthContextValue = {
  status: AuthStatus;
  displayName: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => boolean;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateNickname: (name: string) => Promise<AccountDTO>;
  deleteAccount: (password: string, confirmation: string) => Promise<void>;
  applyDisplayName: (name: string) => void;
  mapError: (err: unknown) => string;
  isUserNotConfirmed: (err: unknown) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionLooksUsable(): boolean {
  const session = loadAuthSession();
  if (!session) return false;
  const accessExp = jwtExpirySeconds(session.accessToken);
  if (accessExp && accessExp > Math.floor(Date.now() / 1000)) return true;
  // access expired — refresh may still work if refresh token present
  return Boolean(session.refreshToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const syncFromSession = useCallback(() => {
    const session = loadAuthSession();
    if (!session) {
      setDisplayName(null);
      setEmail(null);
      setStatus('guest');
      return;
    }
    setDisplayName(getDisplayName(session));
    setEmail(getSessionEmail(session));
    setStatus('authed');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionLooksUsable()) {
        clearAuthSession();
        if (!cancelled) syncFromSession();
        return;
      }
      const token = await getValidAccessToken();
      if (cancelled) return;
      if (!token) {
        syncFromSession();
        return;
      }
      syncFromSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [syncFromSession]);

  const login = useCallback(
    async (loginEmail: string, password: string) => {
      const session = await signIn(loginEmail, password);
      persistCognitoSession(loginEmail.trim(), sessionToTokens(session));
      syncFromSession();
    },
    [syncFromSession],
  );

  const logout = useCallback((): boolean => {
    queryClient.clear();
    const redirecting = logoutWithHostedUiClear();
    if (!redirecting) {
      syncFromSession();
    }
    return redirecting;
  }, [queryClient, syncFromSession]);

  const register = useCallback(async (regEmail: string, password: string, nickname: string) => {
    await signUp(regEmail, password, nickname);
  }, []);

  const confirmEmail = useCallback(async (confirmEmailAddr: string, code: string) => {
    await confirmSignUp(confirmEmailAddr, code);
  }, []);

  const resendCode = useCallback(async (resendEmail: string) => {
    await resendConfirmationCode(resendEmail);
  }, []);

  const requestPasswordReset = useCallback(async (resetEmail: string) => {
    await forgotPassword(resetEmail);
  }, []);

  const confirmPasswordReset = useCallback(
    async (resetEmail: string, code: string, newPassword: string) => {
      await confirmForgotPassword(resetEmail, code, newPassword);
    },
    [],
  );

  const applyDisplayName = useCallback((name: string) => {
    setDisplayName(name.trim() || null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const session = loadAuthSession();
    if (!session) {
      throw new Error('not_authed');
    }
    await cognitoChangePassword(session, currentPassword, newPassword);
  }, []);

  /**
   * Postgres users.name + Cognito name via API admin sync (OAuth access tokens lack
   * aws.cognito.signin.user.admin for client updateAttributes).
   */
  const updateNickname = useCallback(
    async (name: string) => {
      const nicknameError = validateNickname(name);
      if (nicknameError) {
        throw new Error(nicknameError);
      }

      const trimmed = name.trim();
      const session = loadAuthSession();
      if (!session) {
        throw new Error('not_authed');
      }

      let account: AccountDTO;
      try {
        account = await api.updateAccount({ name: trimmed });
      } catch (err) {
        if (err instanceof ApiError && err.status === 502) {
          throw new Error('Could not save nickname right now. Try again in a moment.');
        }
        throw err;
      }
      applyDisplayName(account.name);

      try {
        const refreshedSession = await refreshCognitoSession(session.username, session.refreshToken);
        persistCognitoSession(session.username, sessionToTokens(refreshedSession));
      } catch {
        // Non-fatal: DB + Cognito already updated; header uses API response above.
      }

      return account;
    },
    [applyDisplayName],
  );

  /**
   * Postgres user row first (idempotent DELETE), then Cognito deleteUser.
   *
   * signIn is used here primarily to verify the password; a side effect is a
   * refreshed session, which the subsequent deleteUser call relies on.
   */
  const deleteAccount = useCallback(
    async (password: string, confirmation: string) => {
      if (!isDeleteConfirmationValid(confirmation)) {
        throw new Error('Type DELETE to confirm account deletion.');
      }

      const session = loadAuthSession();
      if (!session) {
        throw new Error('not_authed');
      }

      const orphanGoogle = isOrphanGoogleSession(session);

      if (orphanGoogle) {
        await api.deleteAccount({
          adminCognitoDelete: true,
          idToken: session.idToken,
        });
        logout();
        return;
      }

      if (!password) {
        throw new Error('Password is required.');
      }

      const loginEmail = getSessionEmail(session) ?? session.username;
      const refreshed = await signIn(loginEmail, password);
      persistCognitoSession(loginEmail.trim(), sessionToTokens(refreshed));

      await api.deleteAccount();

      const sessionForDelete = loadAuthSession();
      if (!sessionForDelete) {
        throw new Error('not_authed');
      }

      try {
        await deleteCognitoAccount(sessionForDelete);
      } catch {
        logout();
        throw new AccountDeleteCognitoError();
      }

      logout();
    },
    [logout],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      displayName,
      email,
      login,
      logout,
      register,
      confirmEmail,
      resendCode,
      requestPasswordReset,
      confirmPasswordReset,
      changePassword,
      updateNickname,
      deleteAccount,
      applyDisplayName,
      mapError: mapCognitoError,
      isUserNotConfirmed,
    }),
    [
      status,
      displayName,
      email,
      login,
      logout,
      register,
      confirmEmail,
      resendCode,
      requestPasswordReset,
      confirmPasswordReset,
      changePassword,
      updateNickname,
      deleteAccount,
      applyDisplayName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
