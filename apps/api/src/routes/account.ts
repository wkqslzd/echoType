import type { FastifyInstance } from 'fastify';
import type { User } from '@prisma/client';
import { UpdateAccountInput, type AccountDTO, needsNicknameSetup } from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import { adminDeleteCognitoUser } from '../auth/cognitoAdmin.js';
import { loadCognitoConfig } from '../auth/cognitoConfig.js';
import { syncAccountNicknameToCognito } from '../auth/syncAccountNicknameToCognito.js';
import { verifyAccessToken } from '../auth/verifyAccessToken.js';
import { verifyIdToken } from '../auth/verifyIdToken.js';
import { prisma } from '../prisma.js';
import { z } from 'zod';

const DeleteAccountBody = z.object({
  idToken: z.string().min(1).optional(),
  adminCognitoDelete: z.boolean().optional(),
});

function toAccountDTO(user: User): AccountDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    needsNicknameSetup: needsNicknameSetup(user.name),
    onboardingSeededAt: user.onboardingSeededAt?.toISOString() ?? null,
  };
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function registerAccountRoutes(api: FastifyInstance) {
  api.get('/account', async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    return toAccountDTO(user);
  });

  api.put('/account', async (req, reply) => {
    const parsed = UpdateAccountInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    const accessToken = bearerToken(req.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: parsed.data.name },
    });

    try {
      await syncAccountNicknameToCognito(accessToken, parsed.data.name);
    } catch (err) {
      req.log.error({ err }, 'cognito nickname sync failed');
      return reply.status(502).send({ error: 'cognito_sync_failed' });
    }

    return toAccountDTO(user);
  });

  api.delete('/account', async (req, reply) => {
    const parsed = DeleteAccountBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    await prisma.user.deleteMany({ where: { id: req.userId } });

    if (parsed.data.adminCognitoDelete) {
      const accessToken = bearerToken(req.headers.authorization);
      if (!accessToken || !parsed.data.idToken) {
        return reply.status(400).send({ error: 'id_token_required' });
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

      const claims = parseFederatedTokenClaims(accessPayload, idPayload);
      if (!claims) {
        return reply.status(400).send({ error: 'invalid_token_claims' });
      }

      const { userPoolId } = loadCognitoConfig();
      await adminDeleteCognitoUser({
        userPoolId,
        username: claims.cognitoUsername,
      });
    }

    return reply.status(204).send();
  });
}
