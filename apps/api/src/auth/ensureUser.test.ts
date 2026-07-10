import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient, User } from '@prisma/client';
import {
  ensureUser,
  ProfileIncompleteError,
  resolveUserProfile,
} from './ensureUser.js';

describe('resolveUserProfile', () => {
  it('uses email and name when both present', () => {
    assert.deepEqual(resolveUserProfile({ sub: 's', email: 'a@b.c', name: 'Ann' }), {
      email: 'a@b.c',
      name: 'Ann',
    });
  });

  it('falls back to username for email', () => {
    assert.deepEqual(resolveUserProfile({ sub: 's', username: 'a@b.c', name: 'Ann' }), {
      email: 'a@b.c',
      name: 'Ann',
    });
  });

  it('derives name from email when name missing', () => {
    assert.deepEqual(resolveUserProfile({ sub: 's', email: 'a@b.c' }), {
      email: 'a@b.c',
      name: 'a',
    });
  });

  it('ignores Google_ username as email', () => {
    assert.equal(resolveUserProfile({ sub: 's', username: 'Google_123', name: 'Ann' }), null);
  });
});

describe('ensureUser', () => {
  const baseUser: User = {
    id: '49de54c8-2021-7010-329f-62c3cf7d52b0',
    email: 'a@b.c',
    name: 'Ann',
    createdAt: new Date(),
    updatedAt: new Date(),
    onboardingSeededAt: null,
  };

  it('creates user when profile complete', async () => {
    const create = mock.fn(async () => baseUser);
    const prisma = {
      user: {
        findUnique: async () => null,
        create,
        update: async () => baseUser,
      },
    } as unknown as PrismaClient;

    const user = await ensureUser(prisma, {
      sub: baseUser.id,
      username: 'a@b.c',
      name: 'Ann',
    });

    assert.equal(user.id, baseUser.id);
    assert.equal(create.mock.calls.length, 1);
  });

  it('throws ProfileIncompleteError on create without resolvable email', async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async () => baseUser,
        update: async () => baseUser,
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      () => ensureUser(prisma, { sub: baseUser.id, username: 'Google_123', name: 'Ann' }),
      ProfileIncompleteError,
    );
  });

  it('returns existing user without update when profile incomplete', async () => {
    const update = mock.fn(async () => baseUser);
    const prisma = {
      user: {
        findUnique: async () => baseUser,
        create: async () => baseUser,
        update,
      },
    } as unknown as PrismaClient;

    const user = await ensureUser(prisma, { sub: baseUser.id, username: 'Google_123' });
    assert.equal(user.id, baseUser.id);
    assert.equal(update.mock.calls.length, 0);
  });

  it('creates federated new user with empty name when pendingNickname', async () => {
    const create = mock.fn(async (args: { data: { name: string } }) => ({
      ...baseUser,
      name: args.data.name,
    }));
    const prisma = {
      user: {
        findUnique: async () => null,
        create,
        update: async () => baseUser,
      },
    } as unknown as PrismaClient;

    const user = await ensureUser(
      prisma,
      { sub: baseUser.id, email: 'a@b.c', name: 'Google Name' },
      { pendingNickname: true },
    );

    assert.equal(user.name, '');
    assert.equal(create.mock.calls.length, 1);
  });

  it('does not overwrite name when preserveNickname is set', async () => {
    const update = mock.fn(async () => baseUser);
    const prisma = {
      user: {
        findUnique: async () => baseUser,
        create: async () => baseUser,
        update,
      },
    } as unknown as PrismaClient;

    await ensureUser(prisma, { sub: baseUser.id, email: 'a@b.c', name: 'Google Name' }, {
      preserveNickname: true,
    });
    assert.equal(update.mock.calls.length, 0);
  });
});
