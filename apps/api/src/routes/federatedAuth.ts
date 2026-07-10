import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { claimsFromFederatedTokens } from '../auth/cognitoUserProfile.js';
import { ensureUser, resolveUserProfile } from '../auth/ensureUser.js';
import { linkGoogleFederatedUser } from '../auth/federatedLink.js';
import { syncNativeLinkedAttributes } from '../auth/federatedSync.js';
import { prisma } from '../prisma.js';
import { verifyAccessToken } from '../auth/verifyAccessToken.js';
import { verifyIdToken } from '../auth/verifyIdToken.js';
import { parseFederatedTokenClaims } from '@echotype/shared';

const LinkBody = z.object({
  idToken: z.string().min(1),
});

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

async function syncLinkedNativeByEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) return;
  await syncNativeLinkedAttributes(user.id, user.name);
}

export async function registerFederatedAuthRoutes(api: FastifyInstance) {
  api.post('/auth/federated/link', async (req, reply) => {
    const accessToken = bearerToken(req.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = LinkBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    let accessPayload: Record<string, unknown>;
    let idPayload: Record<string, unknown>;
    try {
      accessPayload = (await verifyAccessToken(accessToken)) as Record<string, unknown>;
      idPayload = (await verifyIdToken(parsed.data.idToken)) as Record<string, unknown>;
    } catch {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    if (String(accessPayload.sub) !== String(idPayload.sub)) {
      return reply.status(401).send({ error: 'token_mismatch' });
    }

    try {
      const result = await linkGoogleFederatedUser({ accessPayload, idPayload });

      if (result.reason === 'already_linked') {
        const claims = parseFederatedTokenClaims(accessPayload, idPayload);
        if (claims?.email) {
          await syncLinkedNativeByEmail(claims.email);
        }
      }

      if (result.reason === 'linked') {
        const claims = parseFederatedTokenClaims(accessPayload, idPayload);
        if (claims?.email) {
          await syncLinkedNativeByEmail(claims.email);
        }
      }

      if (result.reason === 'new_user') {
        const claims = claimsFromFederatedTokens(accessPayload, idPayload);
        const profile = resolveUserProfile(claims);
        if (profile) {
          const stale = await prisma.user.findUnique({ where: { email: profile.email } });
          if (stale && stale.id !== claims.sub) {
            await prisma.user.delete({ where: { id: stale.id } });
          }
        }
        await ensureUser(prisma, claims, { pendingNickname: true });
        return { ...result, needsNicknameSetup: true };
      }

      return result;
    } catch (err) {
      const code =
        err instanceof Error && err.message === 'google_sub_missing'
          ? 'google_sub_missing'
          : typeof err === 'object' &&
              err !== null &&
              'name' in err &&
              typeof (err as { name?: string }).name === 'string'
            ? (err as { name: string }).name
            : 'unknown';
      req.log.error({ err, code }, 'federated link failed');
      return reply.status(500).send({ error: 'link_failed', code });
    }
  });
}
