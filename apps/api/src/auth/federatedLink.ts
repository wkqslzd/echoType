import type { FederatedLinkResult, FederatedTokenClaims } from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import {
  adminDeleteCognitoUser,
  adminGetUserPoolUsername,
  adminLinkGoogleToNativeUser,
  adminListUsersByEmail,
  isAliasExistsError,
  isMergingNotSupportedError,
  isMisleadingLinkedInvalidParameterError,
  isUserNotFoundError,
} from './cognitoAdmin.js';
import { loadCognitoConfig } from './cognitoConfig.js';
import { prisma } from '../prisma.js';

export type CognitoAdminPort = {
  adminGetUserPoolUsername: typeof adminGetUserPoolUsername;
  adminLinkGoogleToNativeUser: typeof adminLinkGoogleToNativeUser;
  adminDeleteCognitoUser: typeof adminDeleteCognitoUser;
  adminListUsersByEmail: typeof adminListUsersByEmail;
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
  adminListUsersByEmail,
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

async function findConfirmedNativeUsernameByEmail(
  email: string,
  admin: CognitoAdminPort,
): Promise<string | null> {
  const { userPoolId } = loadCognitoConfig();
  const users = await admin.adminListUsersByEmail({ userPoolId, email });
  const nativeUsers = users.filter((user) => !user.username.startsWith('Google_'));
  const candidates = nativeUsers.filter((user) => user.status === 'CONFIRMED');

  if (candidates.length > 1) {
    throw new Error('native_user_ambiguous');
  }
  if (candidates[0]) {
    return candidates[0].username;
  }
  if (nativeUsers.length > 0) {
    throw new Error('native_user_unconfirmed');
  }

  return null;
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
 * Link a federated Google session to an existing native Cognito user. Prefer the
 * Postgres email owner; before first native login, discover the confirmed native
 * Cognito user by email. Destination is always the native pool username (UUID/sub).
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
  let nativeUsername: string;

  if (!nativeUser) {
    const discoveredNativeUsername = await findConfirmedNativeUsernameByEmail(claims.email, admin);
    if (!discoveredNativeUsername) {
      return { linked: false, requiresReauth: false, reason: 'new_user' };
    }
    nativeUsername = discoveredNativeUsername;
  } else {
    // Pure Google signup already created Postgres row with id === Cognito sub. Do not
    // AdminLink Google onto itself (InvalidParameterException on repeat sign-in).
    if (nativeUser.id === claims.sub) {
      return { linked: false, requiresReauth: false, reason: 'already_linked' };
    }

    if (!(await nativeCognitoUserExists(nativeUser.id, admin))) {
      return { linked: false, requiresReauth: false, reason: 'new_user' };
    }
    nativeUsername = nativeUser.id;
  }

  const orphanUsername = orphanUsernameFromClaims(claims);

  try {
    await linkThenDeleteOrphan(nativeUsername, claims.googleSub, orphanUsername, admin);
    return { linked: true, requiresReauth: true, reason: 'linked' };
  } catch (err) {
    if (isMergingNotSupportedError(err)) {
      // Hosted UI creates the orphan Google_* user before the API ever sees tokens,
      // so when the native user exists but was never materialized in Postgres the
      // FIRST AdminLink always fails with "Merging is not currently supported".
      // Expected three-step path on this route: link fails -> delete orphan ->
      // retry link. Not a bug; Cognito requires the SourceUser to not be signed
      // up in this state. Failure after the delete is benign: the next Google
      // sign-in recreates the orphan and the native user is untouched.
      await deleteOrphanIfPresent(orphanUsername, admin);
      await attemptLink(nativeUsername, claims.googleSub, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    if (isAliasExistsError(err)) {
      if (orphanUsername === claims.email) {
        throw err;
      }

      await linkThenDeleteOrphan(nativeUsername, claims.googleSub, orphanUsername, admin);
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
