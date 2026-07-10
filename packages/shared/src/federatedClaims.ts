/** Parse Cognito JWT claims for Google federated sign-in (Phase 2+). */

export type CognitoIdentityRecord = {
  userId: string;
  providerName: string;
  providerType?: string;
  primary?: boolean;
};

export type FederatedTokenClaims = {
  sub: string;
  email: string;
  cognitoUsername: string;
  googleSub: string | null;
  /** Branch 1: linked native user — cognito:username is email and Google identity present. */
  isGoogleLinked: boolean;
  /** Orphan federated session before link (cognito:username is Google_<sub>). */
  isOrphanGoogleSession: boolean;
};

export function claimString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseIdentitiesClaim(raw: unknown): CognitoIdentityRecord[] {
  const parseArray = (items: unknown[]): CognitoIdentityRecord[] => {
    const out: CognitoIdentityRecord[] = [];
    for (const entry of items) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const userId = claimString(record, 'userId');
      const providerName = claimString(record, 'providerName');
      if (!userId || !providerName) continue;
      const identity: CognitoIdentityRecord = { userId, providerName };
      const providerType = claimString(record, 'providerType');
      if (providerType) identity.providerType = providerType;
      if (record.primary === true) identity.primary = true;
      out.push(identity);
    }
    return out;
  };

  if (Array.isArray(raw)) {
    return parseArray(raw);
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseIdentitiesClaim(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }

  return [];
}

export function googleSubFromIdentities(identities: CognitoIdentityRecord[]): string | null {
  const google = identities.find((id) => id.providerName === 'Google');
  return google?.userId ?? null;
}

export function hasGoogleIdentity(identities: CognitoIdentityRecord[]): boolean {
  return identities.some((id) => id.providerName === 'Google');
}

/**
 * cognito:username is the pool username (email or Google_<sub>), not JWT sub.
 * Prefer id_token for identities; fall back to access token.
 */
export function parseFederatedTokenClaims(
  accessPayload: Record<string, unknown>,
  idPayload: Record<string, unknown>,
): FederatedTokenClaims | null {
  const sub = claimString(accessPayload, 'sub') ?? claimString(idPayload, 'sub');
  const email = claimString(idPayload, 'email') ?? claimString(accessPayload, 'email');
  const cognitoUsername =
    claimString(accessPayload, 'cognito:username') ??
    claimString(idPayload, 'cognito:username') ??
    claimString(accessPayload, 'username') ??
    claimString(idPayload, 'username');

  if (!sub || !email || !cognitoUsername) return null;

  const identities = [
    ...parseIdentitiesClaim(idPayload.identities),
    ...parseIdentitiesClaim(accessPayload.identities),
  ];
  const orphanGoogle = cognitoUsername.startsWith('Google_');
  let googleSub = googleSubFromIdentities(identities);
  if (!googleSub && orphanGoogle) {
    googleSub = cognitoUsername.slice('Google_'.length) || null;
  }
  const hasGoogle = hasGoogleIdentity(identities);
  // Linked native: UUID or email pool username + Google identity (not an orphan Google_* session).
  const googleLinked = !orphanGoogle && hasGoogle;

  return {
    sub,
    email,
    cognitoUsername,
    googleSub,
    isGoogleLinked: googleLinked,
    isOrphanGoogleSession: orphanGoogle,
  };
}
