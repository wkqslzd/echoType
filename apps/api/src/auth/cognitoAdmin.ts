import {
  AdminDeleteUserCommand,
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { loadCognitoConfig } from './cognitoConfig.js';

let client: CognitoIdentityProviderClient | null = null;

function getClient(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: loadCognitoConfig().region });
  }
  return client;
}

export async function adminLinkGoogleToNativeUser(params: {
  userPoolId: string;
  nativeEmail: string;
  googleSub: string;
}): Promise<void> {
  await getClient().send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: params.userPoolId,
      DestinationUser: {
        ProviderName: 'Cognito',
        ProviderAttributeValue: params.nativeEmail,
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
