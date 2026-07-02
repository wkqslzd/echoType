import {
  AuthenticationDetails,
  CognitoAccessToken,
  CognitoIdToken,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { assertCognitoConfig } from './cognitoConfig.js';
import type { StoredAuthSession } from './authSession.js';

let pool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (!pool) {
    const { userPoolId, clientId } = assertCognitoConfig();
    pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  }
  return pool;
}

export function createCognitoUser(email: string): CognitoUser {
  return new CognitoUser({ Username: email.trim(), Pool: getPool() });
}

/** Rehydrate CognitoUser from persisted SPA tokens (changePassword / updateAttributes). */
export function cognitoUserWithStoredSession(session: StoredAuthSession): CognitoUser {
  const user = createCognitoUser(session.username);
  const cognitoSession = new CognitoUserSession({
    IdToken: new CognitoIdToken({ IdToken: session.idToken }),
    AccessToken: new CognitoAccessToken({ AccessToken: session.accessToken }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: session.refreshToken }),
  });
  user.setSignInUserSession(cognitoSession);
  return user;
}

export function signUp(email: string, password: string, nickname: string): Promise<void> {
  const attributes = [new CognitoUserAttribute({ Name: 'name', Value: nickname.trim() })];
  return new Promise((resolve, reject) => {
    getPool().signUp(email.trim(), password, attributes, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).confirmRegistration(code.trim(), true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = createCognitoUser(email);
    const details = new AuthenticationDetails({
      Username: email.trim(),
      Password: password,
    });
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('NEW_PASSWORD_REQUIRED')),
    });
  });
}

export function refreshCognitoSession(
  email: string,
  refreshToken: string,
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = createCognitoUser(email);
    const token = new CognitoRefreshToken({ RefreshToken: refreshToken });
    user.refreshSession(token, (err, session) => {
      if (err || !session) reject(err ?? new Error('refresh_failed'));
      else resolve(session);
    });
  });
}

export function signOutCognitoUser(email: string): void {
  createCognitoUser(email).signOut();
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function changePassword(
  session: StoredAuthSession,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    cognitoUserWithStoredSession(session).changePassword(currentPassword, newPassword, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function updateUserName(session: StoredAuthSession, name: string): Promise<void> {
  const attributeList = [new CognitoUserAttribute({ Name: 'name', Value: name })];
  return new Promise((resolve, reject) => {
    cognitoUserWithStoredSession(session).updateAttributes(attributeList, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function deleteCognitoAccount(session: StoredAuthSession): Promise<void> {
  // Probe-only: Playwright sets window.__echotypeSimulateCognitoDeleteFailOnce before submit.
  if (typeof window !== 'undefined' && window.__echotypeSimulateCognitoDeleteFailOnce) {
    window.__echotypeSimulateCognitoDeleteFailOnce = false;
    return Promise.reject(new Error('simulated_cognito_delete_failure'));
  }

  return new Promise((resolve, reject) => {
    cognitoUserWithStoredSession(session).deleteUser((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function sessionToTokens(session: CognitoUserSession) {
  return {
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
  };
}
