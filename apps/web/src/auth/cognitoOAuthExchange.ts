import type { FederatedTokenClaims, FederatedLinkResult, CognitoTokenResponse } from '@echotype/shared';
import {
  buildAuthorizationCodeExchangeBody,
  buildCognitoAuthorizeUrl,
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

/** Dev Strict Mode runs effects twice — dedupe in-flight work by auth code. */
const inflightCallbackByCode = new Map<string, Promise<OAuthCallbackOutcome>>();

export type OAuthCallbackOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'redirect'; destination: string; flashGuest: boolean };

function callbackErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 500) {
      return 'Could not link your Google account to an existing profile. Try email sign-in or try again later.';
    }
    if (err.status === 401) {
      return 'Google sign-in session was rejected. Try again.';
    }
  }
  if (err instanceof Error && err.message === 'token_exchange_failed') {
    return 'Google sign-in expired or was already used. Go back and try again.';
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

export function clearPendingOAuth(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_NONCE_STORAGE_KEY);
}

export async function startGoogleSignIn(nextPath: string): Promise<void> {
  const config = assertCognitoOAuthConfig();
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  const stateNonce = randomUrlSafeString(16);
  writePendingOAuth({ codeVerifier, stateNonce });

  const state = encodeOAuthState({
    next: nextPath.startsWith('/') ? nextPath : '/courses/short',
    nonce: stateNonce,
  });

  const url = buildCognitoAuthorizeUrl({
    domainPrefix: config.domainPrefix,
    region: config.region,
    clientId: config.clientId,
    redirectUri: oauthRedirectUri(),
    identityProvider: 'Google',
    prompt: 'login select_account',
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

  clearPendingOAuth();
  return (await res.json()) as CognitoTokenResponse;
}

export function validateOAuthCallbackState(stateParam: string | null): string | null {
  if (!stateParam) return null;
  const parsed = parseOAuthState(stateParam);
  if (!parsed) return null;
  const pending = readPendingOAuth();
  if (!pending || pending.stateNonce !== parsed.nonce) return null;
  return parsed.next;
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
  const nextPath = validateOAuthCallbackState(input.state);
  if (!code || !nextPath) {
    clearPendingOAuth();
    return Promise.resolve({ kind: 'error', message: 'Sign-in expired or invalid. Try again.' });
  }

  const existing = inflightCallbackByCode.get(code);
  if (existing) return existing;

  const work = (async (): Promise<OAuthCallbackOutcome> => {
    try {
      const tokens = await exchangeAuthorizationCode(code);
      const username = sessionUsernameFromTokens(tokens.access_token, tokens.id_token);
      const session = tokensToStoredSession(tokens, username);

      const linkResult = await postFederatedLink(session.accessToken, session.idToken);

      if (linkResult.requiresReauth) {
        clearPendingOAuth();
        void startGoogleSignIn(nextPath);
        return new Promise<OAuthCallbackOutcome>(() => {});
      }

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

  inflightCallbackByCode.set(code, work);
  return work;
}
