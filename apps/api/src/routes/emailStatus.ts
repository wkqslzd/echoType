import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EMAIL_ALREADY_EXISTS_MESSAGE } from '@echotype/shared';
import { adminListUsersByEmail } from '../auth/cognitoAdmin.js';
import { loadCognitoConfig } from '../auth/cognitoConfig.js';
import { prisma } from '../prisma.js';

const EmailStatusBody = z.object({
  email: z.string().trim().email(),
});

export async function registerEmailStatusRoutes(api: FastifyInstance) {
  api.post('/auth/email-status', async (req, reply) => {
    const parsed = EmailStatusBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    const email = parsed.data.email.trim().toLowerCase();

    const pgUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (pgUser) {
      return {
        available: false,
        message: EMAIL_ALREADY_EXISTS_MESSAGE,
      };
    }

    const { userPoolId } = loadCognitoConfig();
    const cognitoUsers = await adminListUsersByEmail({ userPoolId, email });
    if (cognitoUsers.length > 0) {
      return {
        available: false,
        message: EMAIL_ALREADY_EXISTS_MESSAGE,
      };
    }

    return { available: true as const };
  });
}
