import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { loadCognitoConfig } from './cognitoConfig.js';
import type { AccessTokenClaims } from './ensureUser.js';
import { resolveUserProfile } from './ensureUser.js';

let client: CognitoIdentityProviderClient | null = null;

function getClient() {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: loadCognitoConfig().region });
  }
  return client;
}

export function claimsFromAccessTokenPayload(payload: Record<string, unknown>): AccessTokenClaims {
  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    username: typeof payload.username === 'string' ? payload.username : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

/** Prefer id_token for federated email/name; access token for sub. */
export function claimsFromFederatedTokens(
  accessPayload: Record<string, unknown>,
  idPayload: Record<string, unknown>,
): AccessTokenClaims {
  const access = claimsFromAccessTokenPayload(accessPayload);
  const id = claimsFromAccessTokenPayload(idPayload);
  return {
    sub: access.sub,
    email: id.email ?? access.email,
    name: id.name ?? access.name,
    username: id.username ?? access.username,
  };
}

function emailFromClaims(claims: AccessTokenClaims): string | undefined {
  const candidates = [claims.email, claims.username];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.startsWith('Google_') || !trimmed.includes('@')) continue;
    return trimmed;
  }
  return undefined;
}

/** Access tokens often omit name; GetUser(AccessToken) fills profile without admin IAM. */
export async function enrichClaimsFromAccessToken(
  accessToken: string,
  claims: AccessTokenClaims,
): Promise<AccessTokenClaims> {
  if (resolveUserProfile(claims)) return claims;

  try {
    const res = await getClient().send(new GetUserCommand({ AccessToken: accessToken }));
    const attrs = Object.fromEntries(
      (res.UserAttributes ?? [])
        .filter((a): a is { Name: string; Value: string } => Boolean(a.Name && a.Value))
        .map((a) => [a.Name, a.Value]),
    );

    const username = claims.username ?? res.Username;
    const email = claims.email ?? attrs.email ?? emailFromClaims({ ...claims, username });

    return {
      sub: claims.sub,
      email,
      username,
      name: claims.name ?? attrs.name,
    };
  } catch {
    return claims;
  }
}
