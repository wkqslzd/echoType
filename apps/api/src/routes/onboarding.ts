import type { FastifyInstance } from 'fastify';
import {
  decideOnboardingSeed,
  isOnboardingCatalogEmpty,
  ONBOARDING_CATALOG,
} from '@echotype/shared';
import { prisma } from '../prisma.js';
import { materializeOnboardingForUser } from '../../prisma/fixtures/materializeCourse.js';

export async function registerOnboardingRoutes(api: FastifyInstance) {
  api.post('/onboarding/seed', async (req, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    const catalogEmpty = isOnboardingCatalogEmpty(ONBOARDING_CATALOG);
    const courseCount = await prisma.course.count({ where: { userId: req.userId } });

    const decision = decideOnboardingSeed({
      onboardingSeededAt: user.onboardingSeededAt,
      catalogEmpty,
      courseCount,
    });

    if (decision === 'already_resolved' || decision === 'empty_catalog') {
      return reply.status(204).send();
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.user.findUniqueOrThrow({ where: { id: req.userId } });
      if (locked.onboardingSeededAt !== null) {
        return;
      }

      const lockedCount = await tx.course.count({ where: { userId: req.userId } });
      const lockedDecision = decideOnboardingSeed({
        onboardingSeededAt: locked.onboardingSeededAt,
        catalogEmpty,
        courseCount: lockedCount,
      });

      if (lockedDecision === 'empty_catalog') {
        return;
      }

      if (lockedDecision === 'waive') {
        await tx.user.update({
          where: { id: req.userId },
          data: { onboardingSeededAt: new Date() },
        });
        return;
      }

      if (lockedDecision === 'materialize') {
        await materializeOnboardingForUser(tx, req.userId, ONBOARDING_CATALOG);
        await tx.user.update({
          where: { id: req.userId },
          data: { onboardingSeededAt: new Date() },
        });
      }
    });

    return reply.status(204).send();
  });
}
