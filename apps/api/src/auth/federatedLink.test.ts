import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CognitoAdminPort } from './federatedLink.js';
import { linkGoogleFederatedUser } from './federatedLink.js';

const googleIdentities = [
  { userId: '107121059094644779940', providerName: 'Google', providerType: 'Google' },
];

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

  it('returns new_user when native destination is missing', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async () => {
        const err = new Error('not found');
        err.name = 'UserNotFoundException';
        throw err;
      },
      adminDeleteCognitoUser: async () => undefined,
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
    );
    assert.deepEqual(result, {
      linked: false,
      requiresReauth: false,
      reason: 'new_user',
    });
  });

  it('retries link after deleting orphan on AliasExistsException', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let linkCalls = 0;
    let deleteUsername: string | undefined;
    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async () => {
        linkCalls += 1;
        if (linkCalls === 1) {
          const err = new Error('alias exists');
          err.name = 'AliasExistsException';
          throw err;
        }
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
    );
    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(linkCalls, 2);
    assert.equal(deleteUsername, 'Google_107121059094644779940');
  });

  it('deletes orphan and requires reauth on InvalidParameterException', async () => {
    process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_testpool';
    process.env.COGNITO_CLIENT_ID = 'testclient';

    let deleteUsername: string | undefined;
    const admin: CognitoAdminPort = {
      adminLinkGoogleToNativeUser: async () => {
        const err = new Error('invalid parameter');
        err.name = 'InvalidParameterException';
        throw err;
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
    );
    assert.deepEqual(result, {
      linked: true,
      requiresReauth: true,
      reason: 'linked',
    });
    assert.equal(deleteUsername, 'Google_107121059094644779940');
  });
});
