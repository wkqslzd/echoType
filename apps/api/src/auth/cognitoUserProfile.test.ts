import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimsFromFederatedTokens } from './cognitoUserProfile.js';
import { ensureUser, resolveUserProfile } from './ensureUser.js';
import type { PrismaClient, User } from '@prisma/client';

describe('claimsFromFederatedTokens', () => {
  it('prefers id_token email and name over access token Google username', () => {
    const claims = claimsFromFederatedTokens(
      {
        sub: 'fed-sub-uuid',
        username: 'Google_102517236086495542136',
        name: 'Denny Gan',
      },
      {
        sub: 'fed-sub-uuid',
        email: 'gancwdenny@gmail.com',
        name: 'Denny Gan',
        'cognito:username': 'Google_102517236086495542136',
      },
    );
    assert.equal(claims.sub, 'fed-sub-uuid');
    assert.equal(claims.email, 'gancwdenny@gmail.com');
    assert.equal(claims.name, 'Denny Gan');
    assert.equal(claims.username, 'Google_102517236086495542136');
  });
});

describe('new Google user provisioning', () => {
  const createdAt = new Date();

  it('ensureUser creates Postgres row from federated id_token claims', async () => {
    const claims = claimsFromFederatedTokens(
      {
        sub: 'fed-sub-uuid',
        username: 'Google_102517236086495542136',
      },
      {
        sub: 'fed-sub-uuid',
        email: 'gancwdenny@gmail.com',
        name: 'Denny Gan',
        'cognito:username': 'Google_102517236086495542136',
      },
    );

    const profile = resolveUserProfile(claims);
    assert.deepEqual(profile, { email: 'gancwdenny@gmail.com', name: 'Denny Gan' });

    let created: User | undefined;
    const prisma = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === 'fed-sub-uuid' ? created ?? null : null,
        create: async ({ data }: { data: { id: string; email: string; name: string } }) => {
          created = {
            id: data.id,
            email: data.email,
            name: data.name,
            createdAt,
            updatedAt: createdAt,
            onboardingSeededAt: null,
          };
          return created;
        },
        update: async () => {
          throw new Error('unexpected update');
        },
      },
    } as unknown as PrismaClient;

    const user = await ensureUser(prisma, claims);
    assert.equal(user.email, 'gancwdenny@gmail.com');
    assert.equal(user.id, 'fed-sub-uuid');
  });

  it('auth hook path returns existing user when access token lacks email', async () => {
    const stored: User = {
      id: 'fed-sub-uuid',
      email: 'gancwdenny@gmail.com',
      name: 'Denny Gan',
      createdAt,
      updatedAt: createdAt,
      onboardingSeededAt: null,
    };

    const prisma = {
      user: {
        findUnique: async () => stored,
        create: async () => {
          throw new Error('should not create');
        },
        update: async () => {
          throw new Error('should not update');
        },
      },
    } as unknown as PrismaClient;

    const accessOnly = {
      sub: 'fed-sub-uuid',
      username: 'Google_102517236086495542136',
      name: 'Denny Gan',
    };
    assert.equal(resolveUserProfile(accessOnly), null);

    const user = await ensureUser(prisma, accessOnly);
    assert.equal(user.id, stored.id);
  });
});
