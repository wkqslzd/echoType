/** Cognito Hosted UI / Google federation URL helpers (Google sign-in Phase 1+). */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getCrypto() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  return globalThis.crypto;
}

export function buildCognitoHostedUiBaseUrl(domainPrefix: string, region: string): string {
  return `https://${domainPrefix}.auth.${region}.amazoncognito.com`;
}

export function buildCognitoTokenUrl(domainPrefix: string, region: string): string {
  return `${buildCognitoHostedUiBaseUrl(domainPrefix, region)}/oauth2/token`;
}

/** Redirect URI registered in the Google Cloud OAuth client (Cognito IdP handshake). */
export function buildGoogleIdpRedirectUri(domainPrefix: string, region: string): string {
  return `${buildCognitoHostedUiBaseUrl(domainPrefix, region)}/oauth2/idpresponse`;
}

export type OAuthStatePayload = {
  next: string;
  nonce: string;
};

export function encodeOAuthState(payload: OAuthStatePayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function parseOAuthState(raw: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(base64UrlToUtf8(raw)) as Record<string, unknown>;
    const next = typeof parsed.next === 'string' ? parsed.next : '';
    const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : '';
    if (!next.startsWith('/') || !nonce) return null;
    return { next, nonce };
  } catch {
    return null;
  }
}

export function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function codeChallengeS256(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await getCrypto().subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = randomUrlSafeString(32);
  const codeChallenge = await codeChallengeS256(codeVerifier);
  return { codeVerifier, codeChallenge };
}

export type CognitoAuthorizeUrlParams = {
  domainPrefix: string;
  region: string;
  clientId: string;
  redirectUri: string;
  /** When set, skip the Hosted UI chooser and go straight to this IdP (e.g. "Google"). */
  identityProvider?: string;
  /** OAuth prompt (e.g. select_account so Google shows the account picker each time). */
  prompt?: string;
  state?: string;
  codeChallenge?: string;
};

export function buildCognitoAuthorizeUrl(params: CognitoAuthorizeUrlParams): string {
  const base = buildCognitoHostedUiBaseUrl(params.domainPrefix, params.region);
  const search = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: params.redirectUri,
  });
  if (params.identityProvider) {
    search.set('identity_provider', params.identityProvider);
  }
  if (params.prompt) {
    search.set('prompt', params.prompt);
  }
  if (params.state) {
    search.set('state', params.state);
  }
  if (params.codeChallenge) {
    search.set('code_challenge', params.codeChallenge);
    search.set('code_challenge_method', 'S256');
  }
  return `${base}/oauth2/authorize?${search.toString()}`;
}

export type AuthorizationCodeExchangeParams = {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
};

export function buildAuthorizationCodeExchangeBody(
  params: AuthorizationCodeExchangeParams,
): Record<string, string> {
  return {
    grant_type: 'authorization_code',
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  };
}

export type CognitoTokenResponse = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type FederatedLinkResult = {
  linked: boolean;
  requiresReauth: boolean;
  reason: 'already_linked' | 'new_user' | 'linked' | 'not_needed';
};
