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

  it('returns null when name missing', () => {
    assert.equal(resolveUserProfile({ sub: 's', email: 'a@b.c' }), null);
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

  it('throws ProfileIncompleteError on create without name', async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async () => baseUser,
        update: async () => baseUser,
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      () => ensureUser(prisma, { sub: baseUser.id, username: 'a@b.c' }),
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

    const user = await ensureUser(prisma, { sub: baseUser.id, username: 'a@b.c' });
    assert.equal(user.id, baseUser.id);
    assert.equal(update.mock.calls.length, 0);
  });

  it('updates email and name when claims differ', async () => {
    const updated = { ...baseUser, email: 'new@b.c', name: 'Bob' };
    const update = mock.fn(async () => updated);
    const prisma = {
      user: {
        findUnique: async () => baseUser,
        create: async () => baseUser,
        update,
      },
    } as unknown as PrismaClient;

    const user = await ensureUser(prisma, {
      sub: baseUser.id,
      email: 'new@b.c',
      name: 'Bob',
    });

    assert.equal(user.email, 'new@b.c');
    assert.equal(update.mock.calls.length, 1);
  });
});
