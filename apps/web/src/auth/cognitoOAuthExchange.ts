import type { FederatedTokenClaims, FederatedLinkResult, CognitoTokenResponse } from '@echotype/shared';
import {
  buildAuthorizationCodeExchangeBody,
  buildCognitoAuthorizeUrl,
  buildCognitoLogoutUrl,
  buildCognitoTokenUrl,
  encodeOAuthState,
  generatePkcePair,
  parseOAuthState,
  randomUrlSafeString,
} from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import { postFederatedLink, ApiError } from '../lib/api.js';
import { clearAuthSession, persistCognitoSession } from './authSession.js';
import { GUEST_LOGIN_TOAST, resolvePostLoginPath } from './resolvePostLoginPath.js';
import { decodeJwtPayload } from './jwtPayload.js';
import type { StoredAuthSession } from './authSession.js';
import { assertCognitoOAuthConfig, oauthRedirectUri } from './cognitoOAuthConfig.js';

const PKCE_STORAGE_KEY = 'echotype.oauth.pkce';
const STATE_NONCE_STORAGE_KEY = 'echotype.oauth.stateNonce';
const REAUTH_COUNT_KEY = 'echotype.oauth.reauthCount';
const MAX_OAUTH_REAUTH = 1;

/** Prevents Strict Mode from starting two PKCE flows (second overwrites verifier → invalid_grant). */
let googleSignInRedirectStarted = false;

export function resetGoogleSignInRedirectGuard(): void {
  googleSignInRedirectStarted = false;
}

/** Dev Strict Mode runs effects twice — dedupe in-flight work by auth code. */
const inflightCallbackByCode = new Map<string, Promise<OAuthCallbackOutcome>>();
/** Authorization codes are single-use; cache outcomes so refresh/Strict Mode cannot re-exchange. */
const completedOAuthCallbacks = new Map<string, OAuthCallbackOutcome>();

export type OAuthCallbackOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'redirect'; destination: string; flashGuest: boolean }
  | { kind: 'reauth'; nextPath: string; hintEmail?: string };

function linkFailedMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const code =
      'code' in body && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : null;
    if (code === 'google_sub_missing') {
      return 'Google sign-in token was missing required account data. Try again.';
    }
    if (code === 'InvalidParameterException') {
      return 'Could not link Google to your existing email account. Try email sign-in or contact support.';
    }
    if (code) {
      return `Could not link your Google account (${code}). Try email sign-in or try again later.`;
    }
  }
  return 'Could not link your Google account to an existing profile. Try email sign-in or try again later.';
}

function callbackErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 500) {
      return linkFailedMessage(err.body);
    }
    if (err.status === 401) {
      return 'Google sign-in session was rejected. Try again.';
    }
  }
  if (err instanceof Error) {
    if (err.message === 'token_exchange_failed') {
      return 'Google sign-in expired or was already used. Go back and try again.';
    }
    if (err.message === 'oauth_state_missing') {
      return 'Sign-in state was lost. Go back and try Google sign-in again.';
    }
    if (err.message === 'refresh_token_missing') {
      return 'Google sign-in did not return a refresh token. Try again.';
    }
    if (err.message.startsWith('email_hint_mismatch:')) {
      const hint = err.message.slice('email_hint_mismatch:'.length);
      return `Please sign in with ${hint}`;
    }
  }
  return 'Could not complete Google sign-in. Try again.';
}

type PendingOAuth = {
  codeVerifier: string;
  stateNonce: string;
};

function readPendingOAuth(): PendingOAuth | null {
  const codeVerifier = sessionStorage.getItem(PKCE_STORAGE_KEY);
  const stateNonce = sessionStorage.getItem(STATE_NONCE_STORAGE_KEY);
  if (!codeVerifier || !stateNonce) return null;
  return { codeVerifier, stateNonce };
}

function writePendingOAuth(pending: PendingOAuth): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, pending.codeVerifier);
  sessionStorage.setItem(STATE_NONCE_STORAGE_KEY, pending.stateNonce);
}

function clearPendingPkce(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_NONCE_STORAGE_KEY);
}

/** Clears PKCE/state and the reauth attempt counter (successful or abandoned flow). */
export function clearPendingOAuth(): void {
  clearPendingPkce();
  sessionStorage.removeItem(REAUTH_COUNT_KEY);
  resetGoogleSignInRedirectGuard();
}

function bumpReauthCount(): number {
  const next = Number(sessionStorage.getItem(REAUTH_COUNT_KEY) ?? 0) + 1;
  sessionStorage.setItem(REAUTH_COUNT_KEY, String(next));
  return next;
}

export async function startGoogleSignIn(nextPath: string, hintEmail?: string): Promise<void> {
  if (googleSignInRedirectStarted) return;
  googleSignInRedirectStarted = true;

  const config = assertCognitoOAuthConfig();
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  const stateNonce = randomUrlSafeString(16);
  writePendingOAuth({ codeVerifier, stateNonce });

  const state = encodeOAuthState({
    next: nextPath.startsWith('/') ? nextPath : '/courses/short',
    nonce: stateNonce,
    hintEmail: hintEmail?.trim() || undefined,
  });

  const url = buildCognitoAuthorizeUrl({
    domainPrefix: config.domainPrefix,
    region: config.region,
    clientId: config.clientId,
    redirectUri: oauthRedirectUri(),
    identityProvider: 'Google',
    prompt: 'login select_account',
    maxAge: 0,
    state,
    codeChallenge,
  });

  window.location.assign(url);
}

export async function exchangeAuthorizationCode(code: string): Promise<CognitoTokenResponse> {
  const config = assertCognitoOAuthConfig();
  const pending = readPendingOAuth();
  if (!pending) {
    throw new Error('oauth_state_missing');
  }

  const body = buildAuthorizationCodeExchangeBody({
    clientId: config.clientId,
    code,
    redirectUri: oauthRedirectUri(),
    codeVerifier: pending.codeVerifier,
  });

  const res = await fetch(buildCognitoTokenUrl(config.domainPrefix, config.region), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    throw new Error('token_exchange_failed');
  }

  clearPendingPkce();
  return (await res.json()) as CognitoTokenResponse;
}

/** After invalid_grant / abandoned OAuth, clear Hosted UI SSO without keeping the user on callback. */
export function redirectToHostedUiLogout(loginPath = '/login'): void {
  clearAuthSession();
  clearPendingOAuth();
  try {
    const config = assertCognitoOAuthConfig();
    const url = buildCognitoLogoutUrl({
      domainPrefix: config.domainPrefix,
      region: config.region,
      clientId: config.clientId,
      logoutUri: `${window.location.origin}/`,
    });
    window.location.replace(url);
  } catch {
    window.location.replace(loginPath);
  }
}

export function shouldClearHostedUiAfterCallbackError(message: string): boolean {
  return (
    message.includes('expired or was already used') ||
    message.includes('Sign-in state was lost') ||
    message.includes('Please sign in with')
  );
}

/** Clears local app session and Cognito Hosted UI SSO cookie, then returns to /. */
export function logoutWithHostedUiClear(): boolean {
  resetGoogleSignInRedirectGuard();
  clearAuthSession();
  clearPendingOAuth();
  try {
    const config = assertCognitoOAuthConfig();
    const url = buildCognitoLogoutUrl({
      domainPrefix: config.domainPrefix,
      region: config.region,
      clientId: config.clientId,
      logoutUri: `${window.location.origin}/`,
    });
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
}

export function parseOAuthCallbackContext(
  stateParam: string | null,
): { next: string; hintEmail?: string } | null {
  if (!stateParam) return null;
  const parsed = parseOAuthState(stateParam);
  if (!parsed) return null;
  const pending = readPendingOAuth();
  if (!pending || pending.stateNonce !== parsed.nonce) return null;
  return { next: parsed.next, hintEmail: parsed.hintEmail };
}

/** @deprecated Use parseOAuthCallbackContext */
export function validateOAuthCallbackState(stateParam: string | null): string | null {
  return parseOAuthCallbackContext(stateParam)?.next ?? null;
}

function assertTokenEmailMatchesHint(
  accessToken: string,
  idToken: string,
  hintEmail?: string,
): void {
  if (!hintEmail) return;
  const claims = parseFederatedTokenClaims(
    decodeJwtPayload(accessToken),
    decodeJwtPayload(idToken),
  );
  const tokenEmail = claims?.email?.trim().toLowerCase();
  const hint = hintEmail.trim().toLowerCase();
  if (tokenEmail && tokenEmail !== hint) {
    throw new Error(`email_hint_mismatch:${hintEmail}`);
  }
}

export function sessionUsernameFromTokens(
  accessToken: string,
  idToken: string,
  fallbackEmail?: string,
): string {
  const claims = parseFederatedTokenClaims(
    decodeJwtPayload(accessToken),
    decodeJwtPayload(idToken),
  );
  if (!claims) {
    return fallbackEmail ?? '';
  }
  if (claims.isGoogleLinked || !claims.isOrphanGoogleSession) {
    return claims.email;
  }
  return claims.cognitoUsername;
}

export function federatedClaimsFromSession(session: StoredAuthSession): FederatedTokenClaims | null {
  return parseFederatedTokenClaims(
    decodeJwtPayload(session.accessToken),
    decodeJwtPayload(session.idToken),
  );
}

export function isOrphanGoogleSession(session: StoredAuthSession): boolean {
  return federatedClaimsFromSession(session)?.isOrphanGoogleSession ?? false;
}

export type OAuthCallbackSuccess = {
  session: StoredAuthSession;
  linkResult: FederatedLinkResult;
  nextPath: string;
};

export function tokensToStoredSession(
  tokens: CognitoTokenResponse,
  username: string,
): StoredAuthSession {
  if (!tokens.refresh_token) {
    throw new Error('refresh_token_missing');
  }
  return {
    username,
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
  };
}

export function completeOAuthCallbackOnce(input: {
  oauthError: string | null;
  code: string | null;
  state: string | null;
}): Promise<OAuthCallbackOutcome> {
  if (input.oauthError) {
    return Promise.resolve({ kind: 'error', message: 'Sign-in was cancelled. Try again.' });
  }

  const code = input.code;
  const context = parseOAuthCallbackContext(input.state);
  if (!code || !context) {
    clearPendingOAuth();
    return Promise.resolve({ kind: 'error', message: 'Sign-in expired or invalid. Try again.' });
  }
  const { next: nextPath, hintEmail } = context;

  const cached = completedOAuthCallbacks.get(code);
  if (cached) return Promise.resolve(cached);

  const existing = inflightCallbackByCode.get(code);
  if (existing) return existing;

  const work = (async (): Promise<OAuthCallbackOutcome> => {
    try {
      const tokens = await exchangeAuthorizationCode(code);
      assertTokenEmailMatchesHint(tokens.access_token, tokens.id_token, hintEmail);
      const username = sessionUsernameFromTokens(tokens.access_token, tokens.id_token);
      const session = tokensToStoredSession(tokens, username);

      const linkResult = await postFederatedLink(session.accessToken, session.idToken);

      if (linkResult.requiresReauth) {
        const reauthCount = bumpReauthCount();
        if (reauthCount > MAX_OAUTH_REAUTH) {
          clearPendingOAuth();
          return {
            kind: 'error',
            message:
              'Account link did not complete after retry. Try email sign-in or contact support.',
          };
        }
        clearPendingPkce();
        return { kind: 'reauth', nextPath, hintEmail };
      }

      clearPendingOAuth();
      persistCognitoSession(username, {
        accessToken: session.accessToken,
        idToken: session.idToken,
        refreshToken: session.refreshToken,
      });

      const destination = resolvePostLoginPath(nextPath);
      return {
        kind: 'redirect',
        destination,
        flashGuest: destination !== nextPath,
      };
    } catch (err) {
      clearAuthSession();
      clearPendingOAuth();
      return { kind: 'error', message: callbackErrorMessage(err) };
    } finally {
      inflightCallbackByCode.delete(code);
    }
  })();

  const tracked = work.then((outcome) => {
    completedOAuthCallbacks.set(code, outcome);
    return outcome;
  });

  inflightCallbackByCode.set(code, tracked);
  return tracked;
}
