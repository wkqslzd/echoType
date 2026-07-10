import {
  refreshCognitoSession,
  sessionToTokens,
  signOutCognitoUser,
} from './cognitoClient.js';
import { refreshHostedUiTokens } from './cognitoOAuthRefresh.js';
import { claimString, decodeJwtPayload, jwtExpirySeconds } from './jwtPayload.js';

const STORAGE_KEY = 'echotype.auth.session';
const REFRESH_SKEW_SEC = 5 * 60;

export type StoredAuthSession = {
  username: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
};

let memorySession: StoredAuthSession | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function readStorage(): StoredAuthSession | null {
  if (memorySession) return memorySession;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (
      !parsed?.username ||
      !parsed?.accessToken ||
      !parsed?.idToken ||
      !parsed?.refreshToken
    ) {
      return null;
    }
    memorySession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function loadAuthSession(): StoredAuthSession | null {
  return readStorage();
}

export function saveAuthSession(session: StoredAuthSession): void {
  memorySession = session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  const existing = readStorage();
  if (existing?.username) {
    try {
      signOutCognitoUser(existing.username);
    } catch {
      // local clear still proceeds
    }
  }
  memorySession = null;
  refreshInFlight = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function persistCognitoSession(username: string, tokens: ReturnType<typeof sessionToTokens>) {
  saveAuthSession({
    username,
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
  });
}

/**
 * Display nickname for the header.
 *
 * Access tokens from our User Pool usually omit `name` (same as Phase 3 API ensureUser).
 * Try access token first, then ID token from the same session — decode only, no GetUser.
 */
export function getDisplayName(session: StoredAuthSession | null = readStorage()): string | null {
  if (!session) return null;

  const accessPayload = decodeJwtPayload(session.accessToken);
  const fromAccess = claimString(accessPayload, 'name');
  if (fromAccess) return fromAccess;

  const idPayload = decodeJwtPayload(session.idToken);
  const fromId = claimString(idPayload, 'name');
  if (fromId) return fromId;

  const email = claimString(idPayload, 'email') ?? claimString(accessPayload, 'email') ?? session.username;
  const local = email.includes('@') ? email.split('@')[0] : email;
  return local || null;
}

export function getSessionEmail(session: StoredAuthSession | null = readStorage()): string | null {
  if (!session) return null;
  const idPayload = decodeJwtPayload(session.idToken);
  return claimString(idPayload, 'email') ?? session.username;
}

function accessTokenValid(session: StoredAuthSession): boolean {
  const exp = jwtExpirySeconds(session.accessToken);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - REFRESH_SKEW_SEC > now;
}

async function refreshAccessToken(session: StoredAuthSession): Promise<string | null> {
  try {
    if (session.username.startsWith('Google_')) {
      const tokens = await refreshHostedUiTokens(session.refreshToken);
      const next: StoredAuthSession = {
        username: session.username,
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token ?? session.refreshToken,
      };
      saveAuthSession(next);
      return next.accessToken;
    }

    const refreshed = await refreshCognitoSession(session.username, session.refreshToken);
    const tokens = sessionToTokens(refreshed);
    const next: StoredAuthSession = {
      username: session.username,
      ...tokens,
    };
    saveAuthSession(next);
    return next.accessToken;
  } catch {
    clearAuthSession();
    return null;
  }
}

/** Force refresh (e.g. after API 401). Clears session on failure. */
export async function forceRefreshAccessToken(): Promise<string | null> {
  const session = readStorage();
  if (!session) return null;
  return refreshAccessToken(session);
}

/** Access token for API Authorization header; refreshes once when near expiry. */
export async function getValidAccessToken(): Promise<string | null> {
  const session = readStorage();
  if (!session) return null;
  if (accessTokenValid(session)) return session.accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(session).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** For tests — reset module memory without touching localStorage. */
export function _resetAuthSessionMemoryForTests(): void {
  memorySession = null;
  refreshInFlight = null;
}
