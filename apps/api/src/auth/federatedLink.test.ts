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

const noCognitoUsers: CognitoAdminPort['adminListUsersByEmail'] = async () => [];

function adminWithLinkBehavior(
  link: CognitoAdminPort['adminLinkGoogleToNativeUser'],
): CognitoAdminPort {
  return {
    adminGetUserPoolUsername: async ({ usernameOrAlias }) => usernameOrAlias,
    adminLinkGoogleToNativeUser: link,
    adminDeleteCognitoUser: async () => undefined,
    adminListUsersByEmail: noCognitoUsers,
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
      adminListUsersByEmail: async () => {
        throw new Error('should not list');
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

  it('returns new_user when Postgres has no row and Cognito has only the Google orphan', async () => {
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
      adminListUsersByEmail: async () => [
        { username: 'Google_107121059094644779940', status: 'EXTERNAL_PROVIDER' },
      ],
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

  it('links a confirmed native Cognito user when Postgres has not materialized it yet', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const order: string[] = [];
    const nativeUsername = '690e8408-6001-7078-d5b4-694c1c970e50';
    let listedEmail: string | undefined;
    let linkedNative: string | undefined;
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async () => {
        throw new Error('should not get user');
      },
      adminListUsersByEmail: async ({ email }) => {
        order.push('list');
        listedEmail = email;
        return [
          { username: nativeUsername, status: 'CONFIRMED' },
          { username: 'Google_107121059094644779940', status: 'EXTERNAL_PROVIDER' },
        ];
      },
      adminLinkGoogleToNativeUser: async ({ nativeUsername: destination }) => {
        order.push('link');
        linkedNative = destination;
      },
      adminDeleteCognitoUser: async ({ username }) => {
        order.push(`delete:${username}`);
      },
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'pending-native@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'pending-native@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupNewUser,
    );

    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(listedEmail, 'pending-native@example.com');
    assert.equal(linkedNative, nativeUsername);
    assert.deepEqual(order, ['list', 'link', 'delete:Google_107121059094644779940']);
  });

  it('fails closed for an unconfirmed native Cognito user when Postgres has no row', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const admin = adminWithLinkBehavior(async () => {
      throw new Error('should not link');
    });
    admin.adminDeleteCognitoUser = async () => {
      throw new Error('should not delete');
    };
    admin.adminListUsersByEmail = async () => [
      { username: 'unconfirmed-native', status: 'UNCONFIRMED' },
      { username: 'Google_107121059094644779940', status: 'EXTERNAL_PROVIDER' },
    ];

    await assert.rejects(
      () =>
        linkGoogleFederatedUser(
          {
            accessPayload: {
              sub: 'fed-sub',
              email: 'unconfirmed@example.com',
              'cognito:username': 'Google_107121059094644779940',
            },
            idPayload: {
              sub: 'fed-sub',
              email: 'unconfirmed@example.com',
              'cognito:username': 'Google_107121059094644779940',
              identities: googleIdentities,
            },
          },
          admin,
          lookupNewUser,
        ),
      /native_user_unconfirmed/,
    );
  });

  it('recovers from Merging-not-supported: deletes orphan then retries link (pre-materialization route)', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const order: string[] = [];
    const nativeUsername = '690e8408-6001-7078-d5b4-694c1c970e50';
    let linkCalls = 0;
    const admin: CognitoAdminPort = {
      adminGetUserPoolUsername: async () => {
        throw new Error('should not get user');
      },
      adminListUsersByEmail: async () => [
        { username: nativeUsername, status: 'CONFIRMED' },
        { username: 'Google_107121059094644779940', status: 'EXTERNAL_PROVIDER' },
      ],
      adminLinkGoogleToNativeUser: async () => {
        linkCalls += 1;
        order.push('link');
        if (linkCalls === 1) {
          const err = new Error(
            'Merging is not currently supported, provide a SourceUser that has not been signed up in order to link',
          );
          err.name = 'InvalidParameterException';
          throw err;
        }
      },
      adminDeleteCognitoUser: async ({ username }) => {
        order.push(`delete:${username}`);
      },
    };

    const result = await linkGoogleFederatedUser(
      {
        accessPayload: {
          sub: 'fed-sub',
          email: 'pending-native@example.com',
          'cognito:username': 'Google_107121059094644779940',
        },
        idPayload: {
          sub: 'fed-sub',
          email: 'pending-native@example.com',
          'cognito:username': 'Google_107121059094644779940',
          identities: googleIdentities,
        },
      },
      admin,
      lookupNewUser,
    );

    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(linkCalls, 2);
    assert.deepEqual(order, ['link', 'delete:Google_107121059094644779940', 'link']);
  });

  it('propagates the error when retry after Merging-not-supported also fails', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let deleteCount = 0;
    const admin = adminWithLinkBehavior(async () => {
      const err = new Error(
        'Merging is not currently supported, provide a SourceUser that has not been signed up in order to link',
      );
      err.name = 'InvalidParameterException';
      throw err;
    });
    admin.adminDeleteCognitoUser = async () => {
      deleteCount += 1;
    };

    await assert.rejects(
      () =>
        linkGoogleFederatedUser(
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
        ),
      /Merging is not currently supported/,
    );
    assert.equal(deleteCount, 1);
  });

  it('fails closed when multiple confirmed native Cognito users share the email', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const admin = adminWithLinkBehavior(async () => {
      throw new Error('should not link');
    });
    admin.adminListUsersByEmail = async () => [
      { username: 'native-one', status: 'CONFIRMED' },
      { username: 'native-two', status: 'CONFIRMED' },
    ];

    await assert.rejects(
      () =>
        linkGoogleFederatedUser(
          {
            accessPayload: {
              sub: 'fed-sub',
              email: 'ambiguous@example.com',
              'cognito:username': 'Google_107121059094644779940',
            },
            idPayload: {
              sub: 'fed-sub',
              email: 'ambiguous@example.com',
              'cognito:username': 'Google_107121059094644779940',
              identities: googleIdentities,
            },
          },
          admin,
          lookupNewUser,
        ),
      /native_user_ambiguous/,
    );
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
      adminListUsersByEmail: async () => {
        throw new Error('should not list');
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
      adminListUsersByEmail: async () => {
        throw new Error('should not list');
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
      adminListUsersByEmail: async () => {
        throw new Error('should not list');
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
