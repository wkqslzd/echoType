import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { loadCognitoConfig } from './cognitoConfig.js';

let client: CognitoIdentityProviderClient | null = null;

function getClient(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: loadCognitoConfig().region });
  }
  return client;
}

export async function adminGetUserPoolUsername(params: {
  userPoolId: string;
  usernameOrAlias: string;
}): Promise<string> {
  const res = await getClient().send(
    new AdminGetUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.usernameOrAlias,
    }),
  );
  return res.Username ?? params.usernameOrAlias;
}

export async function adminLinkGoogleToNativeUser(params: {
  userPoolId: string;
  nativeUsername: string;
  googleSub: string;
}): Promise<void> {
  await getClient().send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: params.userPoolId,
      DestinationUser: {
        ProviderName: 'Cognito',
        ProviderAttributeValue: params.nativeUsername,
      },
      SourceUser: {
        ProviderName: 'Google',
        ProviderAttributeName: 'Cognito_Subject',
        ProviderAttributeValue: params.googleSub,
      },
    }),
  );
}

export async function adminDeleteCognitoUser(params: {
  userPoolId: string;
  username: string;
}): Promise<void> {
  await getClient().send(
    new AdminDeleteUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
    }),
  );
}

export async function adminUpdateUserAttributes(params: {
  userPoolId: string;
  username: string;
  attributes: Record<string, string>;
}): Promise<void> {
  const entries = Object.entries(params.attributes);
  if (entries.length === 0) return;
  await getClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
      UserAttributes: entries.map(([Name, Value]) => ({ Name, Value })),
    }),
  );
}

export function isAliasExistsError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AliasExistsException'
  );
}

export function isUserNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'UserNotFoundException'
  );
}

export function isInvalidParameterError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'InvalidParameterException'
  );
}

/** Cognito quirk: link may succeed but repeat calls throw this misleading message. */
export function isMisleadingLinkedInvalidParameterError(err: unknown): boolean {
  if (!isInvalidParameterError(err)) return false;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : '';
  return message.includes('may not be passed in as a SourceUser');
}

/**
 * AdminLink rejects a SourceUser that already exists in the pool: "Merging is not
 * currently supported, provide a SourceUser that has not been signed up in order
 * to link". Recovery = delete the orphan Google_* user, then retry the link.
 */
export function isMergingNotSupportedError(err: unknown): boolean {
  if (!isInvalidParameterError(err)) return false;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : '';
  return message.includes('Merging is not currently supported');
}

export async function adminListUsersByEmail(params: {
  userPoolId: string;
  email: string;
}): Promise<Array<{ username: string; status?: string }>> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return [];

  const safe = email.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const res = await getClient().send(
    new ListUsersCommand({
      UserPoolId: params.userPoolId,
      Filter: `email = "${safe}"`,
      Limit: 5,
    }),
  );

  return (res.Users ?? [])
    .map((u) => ({
      username: u.Username ?? '',
      status: u.UserStatus,
    }))
    .filter((u) => u.username);
}
