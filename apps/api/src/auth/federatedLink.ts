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

export type CognitoAdminPort = {
  adminLinkGoogleToNativeUser: typeof adminLinkGoogleToNativeUser;
  adminDeleteCognitoUser: typeof adminDeleteCognitoUser;
  adminGetUserPoolUsername: typeof adminGetUserPoolUsername;
};

const defaultCognitoAdmin: CognitoAdminPort = {
  adminLinkGoogleToNativeUser,
  adminDeleteCognitoUser,
  adminGetUserPoolUsername,
};

export type FederatedLinkInput = {
  accessPayload: Record<string, unknown>;
  idPayload: Record<string, unknown>;
};

function orphanUsernameFromGoogleSub(googleSub: string): string {
  return `Google_${googleSub}`;
}

async function attemptLink(
  claims: FederatedTokenClaims,
  admin: CognitoAdminPort,
): Promise<void> {
  const { userPoolId } = loadCognitoConfig();
  if (!claims.googleSub) {
    throw new Error('google_sub_missing');
  }

  const nativeUsername = await admin.adminGetUserPoolUsername({
    userPoolId,
    usernameOrAlias: claims.email,
  });

  await admin.adminLinkGoogleToNativeUser({
    userPoolId,
    nativeUsername,
    googleSub: claims.googleSub,
  });
}

/**
 * Link a federated Google session to an existing native Cognito user (email username).
 * Scheme A: Destination = email, Source = Cognito_Subject; no ListUsers.
 */
export async function linkGoogleFederatedUser(
  input: FederatedLinkInput,
  admin: CognitoAdminPort = defaultCognitoAdmin,
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

  try {
    await attemptLink(claims, admin);
    return { linked: true, requiresReauth: true, reason: 'linked' };
  } catch (err) {
    if (isUserNotFoundError(err)) {
      return { linked: false, requiresReauth: false, reason: 'new_user' };
    }

    if (isAliasExistsError(err)) {
      const orphanUsername = claims.cognitoUsername.startsWith('Google_')
        ? claims.cognitoUsername
        : orphanUsernameFromGoogleSub(claims.googleSub);

      if (orphanUsername === claims.email) {
        throw err;
      }

      const { userPoolId } = loadCognitoConfig();
      await admin.adminDeleteCognitoUser({ userPoolId, username: orphanUsername });
      await attemptLink(claims, admin);
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    if (isMisleadingLinkedInvalidParameterError(err)) {
      if (claims.cognitoUsername.startsWith('Google_')) {
        const { userPoolId } = loadCognitoConfig();
        await admin.adminDeleteCognitoUser({ userPoolId, username: claims.cognitoUsername });
      }
      return { linked: true, requiresReauth: true, reason: 'linked' };
    }

    throw err;
  }
}
