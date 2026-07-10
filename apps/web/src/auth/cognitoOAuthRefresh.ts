import type { CognitoTokenResponse } from '@echotype/shared';
import { buildCognitoTokenUrl } from '@echotype/shared';
import { assertCognitoOAuthConfig } from './cognitoOAuthConfig.js';

/** Hosted UI / Google federated sessions: refresh via oauth2/token (no Cognito username). */
export async function refreshHostedUiTokens(refreshToken: string): Promise<CognitoTokenResponse> {
  const config = assertCognitoOAuthConfig();
  const res = await fetch(buildCognitoTokenUrl(config.domainPrefix, config.region), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error('refresh_failed');
  }

  return (await res.json()) as CognitoTokenResponse;
}
