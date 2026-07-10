import type { PrismaClient, User } from '@prisma/client';

export class ProfileIncompleteError extends Error {
  constructor() {
    super('profile_incomplete');
    this.name = 'ProfileIncompleteError';
  }
}

export type AccessTokenClaims = {
  sub: string;
  email?: string;
  username?: string;
  name?: string;
};

export type EnsureUserOptions = {
  /** Linked native + Google: never overwrite Postgres nickname from JWT (G1A). */
  preserveNickname?: boolean;
  /** Pure Google new user: create with empty name until /account setup (G3A). */
  pendingNickname?: boolean;
};

export function resolveUserProfile(claims: AccessTokenClaims): { email: string; name: string } | null {
  const email =
    claims.email?.trim() && !claims.email.trim().startsWith('Google_') && claims.email.includes('@')
      ? claims.email.trim()
      : claims.username?.trim() &&
          !claims.username.trim().startsWith('Google_') &&
          claims.username.includes('@')
        ? claims.username.trim()
        : '';
  if (!email) return null;

  const name = claims.name?.trim() || email.split('@')[0] || 'User';
  return { email, name };
}

export async function ensureUser(
  prisma: PrismaClient,
  claims: AccessTokenClaims,
  options?: EnsureUserOptions,
): Promise<User> {
  const { sub } = claims;
  if (!sub) {
    throw new Error('missing sub');
  }

  const profile = resolveUserProfile(claims);
  const existing = await prisma.user.findUnique({ where: { id: sub } });

  if (existing) {
    if (!profile) return existing;
    const data: { email?: string; name?: string } = {};
    if (profile.email !== existing.email) data.email = profile.email;
    const skipNameUpdate = options?.preserveNickname || existing.name.trim() === '';
    if (!skipNameUpdate && profile.name !== existing.name) data.name = profile.name;
    if (Object.keys(data).length === 0) return existing;
    return prisma.user.update({ where: { id: sub }, data });
  }

  if (!profile) {
    throw new ProfileIncompleteError();
  }

  return prisma.user.create({
    data: {
      id: sub,
      email: profile.email,
      name: options?.pendingNickname ? '' : profile.name,
    },
  });
}
