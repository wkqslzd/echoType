import type { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { parseFederatedTokenClaims } from '@echotype/shared';
import {
  claimsFromAccessTokenPayload,
  enrichClaimsFromAccessToken,
} from './cognitoUserProfile.js';
import { ensureUser, ProfileIncompleteError } from './ensureUser.js';
import { verifyAccessToken } from './verifyAccessToken.js';

const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/auth/federated/link',
  '/api/auth/email-status',
]);
if (process.env.SENTRY_DEBUG === '1') {
  PUBLIC_API_PATHS.add('/api/debug/sentry');
}

function requestPath(url: string): string {
  return url.split('?')[0] ?? url;
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export async function registerAuthHook(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS') return;

    const path = requestPath(req.url);
    if (PUBLIC_API_PATHS.has(path)) return;

    const token = bearerToken(req.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    try {
      const payload = await verifyAccessToken(token);
      let claims = claimsFromAccessTokenPayload(payload as Record<string, unknown>);
      claims = await enrichClaimsFromAccessToken(token, claims);
      const federated = parseFederatedTokenClaims(
        payload as Record<string, unknown>,
        payload as Record<string, unknown>,
      );
      const user = await ensureUser(prisma, claims, {
        preserveNickname: federated?.isGoogleLinked === true,
      });
      req.userId = user.id;
    } catch (err) {
      if (err instanceof ProfileIncompleteError) {
        return reply.status(403).send({ error: 'profile_incomplete' });
      }
      req.log.debug({ err }, 'jwt auth failed');
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });
}
