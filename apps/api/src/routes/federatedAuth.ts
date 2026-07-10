import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { linkGoogleFederatedUser } from '../auth/federatedLink.js';
import { verifyAccessToken } from '../auth/verifyAccessToken.js';
import { verifyIdToken } from '../auth/verifyIdToken.js';

const LinkBody = z.object({
  idToken: z.string().min(1),
});

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
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
