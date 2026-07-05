import type { FastifyInstance } from 'fastify';
import type { User } from '@prisma/client';
import { UpdateAccountInput, type AccountDTO } from '@echotype/shared';
import { prisma } from '../prisma.js';

function toAccountDTO(user: User): AccountDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onboardingSeededAt: user.onboardingSeededAt?.toISOString() ?? null,
  };
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

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: parsed.data.name },
    });

    return toAccountDTO(user);
  });

  api.delete('/account', async (req, reply) => {
    // Idempotent: user row may already be gone if a prior attempt deleted DB but Cognito failed.
    await prisma.user.deleteMany({ where: { id: req.userId } });
    return reply.status(204).send();
  });
}
