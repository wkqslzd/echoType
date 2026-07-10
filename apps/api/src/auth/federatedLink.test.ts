import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CognitoAdminPort, UserLookupPort } from './federatedLink.js';
import { linkGoogleFederatedUser } from './federatedLink.js';

const googleIdentities = [
  { userId: '107121059094644779940', providerName: 'Google', providerType: 'Google' },
];

const nativeUserId = 'e9be9418-40a1-70ee-de57-e2f27405b3bb';

const lookupWithNative: UserLookupPort = {
  findNativeUserIdByEmail: async () => nativeUserId,
};

const lookupNewUser: UserLookupPort = {
  findNativeUserIdByEmail: async () => null,
};

function adminWithLinkBehavior(
  link: CognitoAdminPort['adminLinkGoogleToNativeUser'],
): CognitoAdminPort {
  return {
    adminLinkGoogleToNativeUser: link,
    adminDeleteCognitoUser: async () => undefined,
  };
}

describe('linkGoogleFederatedUser', () => {
  it('skips when already linked (cognito:username is email)', async () => {
    const result = await linkGoogleFederatedUser({
      accessPayload: { sub: 'native-sub', email: 'user@example.com' },
      idPayload: {
        sub: 'native-sub',
        email: 'user@example.com',
        'cognito:username': 'user@example.com',
        identities: googleIdentities,
      },
    });
    assert.deepEqual(result, {
      linked: false,
      requiresReauth: false,
      reason: 'already_linked',
    });
  });

  it('returns new_user when Postgres has no row for email', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async () => {
        throw new Error('should not link');
      },
      adminDeleteCognitoUser: async () => {
        throw new Error('should not delete');
      },
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'new@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'new@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupNewUser,
    );
    assert.deepEqual(result, {
      linked: false,
      requiresReauth: false,
      reason: 'new_user',
    });
  });

  it('deletes orphan and links to native pool username from Postgres', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let linkedNative: string | undefined;
    let linkedGoogleSub: string | undefined;
    let deleteUsername: string | undefined;
    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async (params) => {
        linkedNative = params.nativeUsername;
        linkedGoogleSub = params.googleSub;
      },
      adminDeleteCognitoUser: async ({ username }) => {
        deleteUsername = username;
      },
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupWithNative,
    );
    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(linkedNative, nativeUserId);
    assert.equal(linkedGoogleSub, '107121059094644779940');
    assert.equal(deleteUsername, 'Google_107121059094644779940');
  });

  it('retries link after deleting orphan on AliasExistsException', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let linkCalls = 0;
    let deleteCount = 0;
    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async () => {
        linkCalls += 1;
        if (linkCalls === 1) {
          const err = new Error('alias exists');
          err.name = 'AliasExistsException';
          throw err;
        }
      },
      adminDeleteCognitoUser: async () => {
        deleteCount += 1;
      },
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupWithNative,
    );
    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(linkCalls, 2);
    assert.equal(deleteCount, 2);
  });

  it('deletes orphan and requires reauth on misleading InvalidParameterException', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let deleteCount = 0;
    const admin = adminWithLinkBehavior(async () => {
      const err = new Error(
        'Invalid SourceUser: Cognito users with a username/password may not be passed in as a SourceUser',
      );
      err.name = 'InvalidParameterException';
      throw err;
    });
    admin.adminDeleteCognitoUser = async () => {
      deleteCount += 1;
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'user@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupWithNative,
    );
    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(deleteCount, 2);
  });
});
