import type { FederatedLinkResult, FederatedTokenClaims } from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import {
  adminDeleteCognitoUser,
  adminLinkGoogleToNativeUser,
  isAliasExistsError,
  isMisleadingLinkedInvalidParameterError,
} from './cognitoAdmin.js';
import { loadCognitoConfig } from './cognitoConfig.js';
import { prisma } from '../prisma.js';

export type CognitoAdminPort = {
  adminLinkGoogleToNativeUser: typeof adminLinkGoogleToNativeUser;
  adminDeleteCognitoUser: typeof adminDeleteCognitoUser;
};

export type UserLookupPort = {
  findNativeUserIdByEmail: (email: string) => Promise<string | null>;
};

const defaultCognitoAdmin: CognitoAdminPort = {
  adminLinkGoogleToNativeUser,
  adminDeleteCognitoUser,
};

const defaultUserLookup: UserLookupPort = {
  findNativeUserIdByEmail: async (email) => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  },
};

export type FederatedLinkInput = {
  accessPayload: Record<string, unknown>;
  idPayload: Record<string, unknown>;
};

function orphanUsernameFromGoogleSub(googleSub: string): string {
  return `Google_${googleSub}`;
}

function orphanUsernameFromClaims(claims: FederatedTokenClaims): string {
  if (claims.cognitoUsername.startsWith('Google_')) {
    return claims.cognitoUsername;
  }
  return orphanUsernameFromGoogleSub(claims.googleSub!);
}

async function attemptLink(
  nativeUsername: string,
  googleSub: string,
  admin: CognitoAdminPort,
): Promise<void> {
  const { userPoolId } = loadCognitoConfig();
  await admin.adminLinkGoogleToNativeUser({
    userPoolId,
    nativeUsername,
    googleSub,
  });
}

async function deleteOrphanIfPresent(
  orphanUsername: string,
  admin: CognitoAdminPort,
): Promise<void> {
  if (!orphanUsername.startsWith('Google_')) return;
  const { userPoolId } = loadCognitoConfig();
  await admin.adminDeleteCognitoUser({ userPoolId, username: orphanUsername });
}

/**
 * Link a federated Google session to an existing native Cognito user when Postgres
 * already has that email (forced linking). Destination = users.id (native pool username).
 */
export async function linkGoogleFederatedUser(
  input: FederatedLinkInput,
  admin: CognitoAdminPort = defaultCognitoAdmin,
  userLookup: UserLookupPort = defaultUserLookup,
): Promise<FederatedLinkResult> {
  const claims = parseFederatedTokenClaims(input.accessPayload, input.idPayload);
  if (!claims) {
    throw new Error('invalid_token_claims');
  }

  if (claims.isGoogleLinked) {
    return { linked: false, requiresReauth: false, reason: 'already_linked' };
  }

  if (!claims.isOrphanGoogleSession) {
    return { linked: false, requiresReauth: false, reason: 'not_needed' };
  }

  if (!claims.googleSub) {
    throw new Error('google_sub_missing');
  }

  const nativeUserId = await userLookup.findNativeUserIdByEmail(claims.email);
  if (!nativeUserId) {
    return { linked: false, requiresReauth: false, reason: 'new_user' };
  }

  const orphanUsername = orphanUsernameFromClaims(claims);

  try {
    await deleteOrphanIfPresent(orphanUsername, admin);
    await attemptLink(nativeUserId, claims.googleSub, admin);
    return { linked: true, requiresReauth: true, reason: 'linked' };
  } catch (err) {
    if (isAliasExistsError(err)) {
      if (orphanUsername === claims.email) {
        throw err;
      }

      await deleteOrphanIfPresent(orphanUsername, admin);
      await attemptLink(nativeUserId, claims.googleSub, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    if (isMisleadingLinkedInvalidParameterError(err)) {
      await deleteOrphanIfPresent(orphanUsername, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    throw err;
  }
}
