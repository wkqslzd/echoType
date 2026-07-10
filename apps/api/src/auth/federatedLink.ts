import type { FederatedLinkResult, FederatedTokenClaims } from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import {
  adminDeleteCognitoUser,
  adminGetUserPoolUsername,
  adminLinkGoogleToNativeUser,
  isAliasExistsError,
  isMisleadingLinkedInvalidParameterError,
  isUserNotFoundError,
} from './cognitoAdmin.js';
import { loadCognitoConfig } from './cognitoConfig.js';
import { prisma } from '../prisma.js';

export type CognitoAdminPort = {
  adminGetUserPoolUsername: typeof adminGetUserPoolUsername;
  adminLinkGoogleToNativeUser: typeof adminLinkGoogleToNativeUser;
  adminDeleteCognitoUser: typeof adminDeleteCognitoUser;
};

export type NativeUserRecord = {
  id: string;
  name: string;
};

export type UserLookupPort = {
  findNativeUserByEmail: (email: string) => Promise<NativeUserRecord | null>;
};

const defaultCognitoAdmin: CognitoAdminPort = {
  adminGetUserPoolUsername,
  adminLinkGoogleToNativeUser,
  adminDeleteCognitoUser,
};

const defaultUserLookup: UserLookupPort = {
  findNativeUserByEmail: async (email) => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });
    return user;
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

async function nativeCognitoUserExists(
  nativeUsername: string,
  admin: CognitoAdminPort,
): Promise<boolean> {
  const { userPoolId } = loadCognitoConfig();
  try {
    await admin.adminGetUserPoolUsername({ userPoolId, usernameOrAlias: nativeUsername });
    return true;
  } catch (err) {
    if (isUserNotFoundError(err)) return false;
    throw err;
  }
}

async function deleteOrphanIfPresent(
  orphanUsername: string,
  admin: CognitoAdminPort,
): Promise<void> {
  if (!orphanUsername.startsWith('Google_')) return;
  const { userPoolId } = loadCognitoConfig();
  try {
    await admin.adminDeleteCognitoUser({ userPoolId, username: orphanUsername });
  } catch (err) {
    if (isUserNotFoundError(err)) return;
    throw err;
  }
}

async function linkThenDeleteOrphan(
  nativeUserId: string,
  googleSub: string,
  orphanUsername: string,
  admin: CognitoAdminPort,
): Promise<void> {
  await attemptLink(nativeUserId, googleSub, admin);
  await deleteOrphanIfPresent(orphanUsername, admin);
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

  const nativeUser = await userLookup.findNativeUserByEmail(claims.email);
  if (!nativeUser) {
    return { linked: false, requiresReauth: false, reason: 'new_user' };
  }

  // Pure Google signup already created Postgres row with id === Cognito sub. Do not
  // AdminLink Google onto itself (InvalidParameterException on repeat sign-in).
  if (nativeUser.id === claims.sub) {
    return { linked: false, requiresReauth: false, reason: 'already_linked' };
  }

  if (!(await nativeCognitoUserExists(nativeUser.id, admin))) {
    return { linked: false, requiresReauth: false, reason: 'new_user' };
  }

  const orphanUsername = orphanUsernameFromClaims(claims);

  try {
    await linkThenDeleteOrphan(nativeUser.id, claims.googleSub, orphanUsername, admin);
    return { linked: true, requiresReauth: true, reason: 'linked' };
  } catch (err) {
    if (isAliasExistsError(err)) {
      if (orphanUsername === claims.email) {
        throw err;
      }

      await linkThenDeleteOrphan(nativeUser.id, claims.googleSub, orphanUsername, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    if (isMisleadingLinkedInvalidParameterError(err)) {
      await deleteOrphanIfPresent(orphanUsername, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    if (isUserNotFoundError(err)) {
      return { linked: false, requiresReauth: false, reason: 'new_user' };
    }

    throw err;
  }
}
