import { parseFederatedTokenClaims } from '@echotype/shared';
import { adminUpdateUserAttributes } from './cognitoAdmin.js';
import {
  claimsFromAccessTokenPayload,
  enrichClaimsFromAccessToken,
} from './cognitoUserProfile.js';
import { loadCognitoConfig } from './cognitoConfig.js';
import { verifyAccessToken } from './verifyAccessToken.js';

/** Pool username for Admin* APIs (email, Google_<sub>, or enriched GetUser username). */
export async function resolveCognitoPoolUsername(accessToken: string): Promise<string> {
  const payload = (await verifyAccessToken(accessToken)) as Record<string, unknown>;
  const federated = parseFederatedTokenClaims(payload, payload);
  if (federated?.cognitoUsername) return federated.cognitoUsername;

  let claims = claimsFromAccessTokenPayload(payload);
  claims = await enrichClaimsFromAccessToken(accessToken, claims);

  const username = claims.username?.trim();
  if (username) return username;

  const email = claims.email?.trim();
  if (email && email.includes('@')) return email;

  throw new Error('cognito_username_unresolved');
}

/** Keep Cognito name in sync when nickname changes via PUT /account (OAuth tokens lack update scopes). */
export async function syncAccountNicknameToCognito(
  accessToken: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const { userPoolId } = loadCognitoConfig();
  const username = await resolveCognitoPoolUsername(accessToken);
  await adminUpdateUserAttributes({
    userPoolId,
    username,
    attributes: { name: trimmed },
  });
}
