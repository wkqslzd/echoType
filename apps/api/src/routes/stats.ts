import type { FastifyInstance } from 'fastify';
import { PracticeSummaryDTO } from '@echotype/shared';
import { prisma } from '../prisma.js';

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get('/stats/summary', async (req) => {
    const agg = await prisma.course.aggregate({
      where: { userId: req.userId },
      _sum: {
        totalDurationSec: true,
        totalCompletedPasses: true,
      },
      _max: {
        lastPracticedAt: true,
      },
    });

    const lastSavedAt = agg._max.lastPracticedAt?.toISOString() ?? null;
    const hasSessions = lastSavedAt !== null;

    return PracticeSummaryDTO.parse({
      totalDurationSec: agg._sum.totalDurationSec ?? 0,
      totalCompletedPasses: agg._sum.totalCompletedPasses ?? 0,
      lastSavedAt,
      hasSessions,
    });
  });
}
