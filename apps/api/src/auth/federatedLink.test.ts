import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CognitoAdminPort, UserLookupPort } from './federatedLink.js';
import { linkGoogleFederatedUser } from './federatedLink.js';

const googleIdentities = [
  { userId: '107121059094644779940', providerName: 'Google', providerType: 'Google' },
];

const nativeUserId = 'e9be9418-40a1-70ee-de57-e2f27405b3bb';

const lookupWithNative: UserLookupPort = {
  findNativeUserByEmail: async () => ({ id: nativeUserId, name: 'DennyG' }),
};

const lookupNewUser: UserLookupPort = {
  findNativeUserByEmail: async () => null,
};

function adminWithLinkBehavior(
  link: CognitoAdminPort['adminLinkGoogleToNativeUser'],
): CognitoAdminPort {
  return {
    adminGetUserPoolUsername: async ({ usernameOrAlias }) => usernameOrAlias,
    adminLinkGoogleToNativeUser: link,
    adminDeleteCognitoUser: async () => undefined,
  };
}

describe('linkGoogleFederatedUser', () => {
  it('skips when already linked (UUID username + Google identity)', async () => {
    const result = await linkGoogleFederatedUser({
      accessPayload: { sub: 'native-sub', email: 'user@example.com' },
      idPayload: {
        sub: 'native-sub',
        email: 'user@example.com',
        'cognito:username': 'e9be9418-40a1-70ee-de57-e2f27405b3bb',
        identities: googleIdentities,
      },
    });
    assert.deepEqual(result, {
      linked: false,
      requiresReauth: false,
      reason: 'already_linked',
    });
  });

  it('returns already_linked when Postgres row is the same Cognito sub (repeat Google-only sign-in)', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const sameSub = 'fed-sub-same';
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async () => {
        throw new Error('should not lookup');
      },
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
          sub: sameSub,
          email: 'google-only@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: sameSub,
          email: 'google-only@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      {
        findNativeUserByEmail: async () => ({ id: sameSub, name: 'Nick' }),
      },
    );
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
      adminGetUserPoolUsername: async () => {
        throw Object.assign(new Error('should not lookup'), { name: 'UserNotFoundException' });
      },
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

  it('links then deletes orphan (link before delete)', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const order: string[] = [];
    let linkedNative: string | undefined;
    let linkedGoogleSub: string | undefined;
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async ({ usernameOrAlias }) => usernameOrAlias,
      adminLinkGoogleToNativeUser: async (params) => {
        order.push('link');
        linkedNative = params.nativeUsername;
        linkedGoogleSub = params.googleSub;
      },
      adminDeleteCognitoUser: async ({ username }) => {
        order.push(`delete:${username}`);
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
    assert.deepEqual(order, ['link', 'delete:Google_107121059094644779940']);
  });

  it('retries link after AliasExistsException then deletes orphan', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let linkCalls = 0;
    let deleteCount = 0;
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async ({ usernameOrAlias }) => usernameOrAlias,
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
    assert.equal(deleteCount, 1);
  });

  it('deletes orphan on misleading InvalidParameterException after failed link', async () => {
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
    admin.adminGetUserPoolUsername = async ({ usernameOrAlias }) => usernameOrAlias;
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
    assert.equal(deleteCount, 1);
  });

  it('returns new_user when link fails with UserNotFoundException', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let deleteCount = 0;
    const admin = adminWithLinkBehavior(async () => {
      const err = new Error('User does not exist.');
      err.name = 'UserNotFoundException';
      throw err;
    });
    admin.adminGetUserPoolUsername = async ({ usernameOrAlias }) => usernameOrAlias;
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
      linked: false,
      requiresReauth: false,
      reason: 'new_user',
    });
    assert.equal(deleteCount, 0);
  });

  it('returns new_user without deleting orphan when Postgres id is not a native pool user', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let deleteCount = 0;
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async () => {
        const err = new Error('User does not exist.');
        err.name = 'UserNotFoundException';
        throw err;
      },
      adminLinkGoogleToNativeUser: async () => {
        throw new Error('should not link');
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
      linked: false,
      requiresReauth: false,
      reason: 'new_user',
    });
    assert.equal(deleteCount, 0);
  });
});
