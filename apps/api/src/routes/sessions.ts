import type { FastifyInstance } from 'fastify';
import { CreateSessionInput } from '@echotype/shared';
import { prisma } from '../prisma.js';

export async function registerSessionRoutes(app: FastifyInstance) {
  app.post('/sessions', async (req, reply) => {
    const body = CreateSessionInput.parse(req.body);

    const course = await prisma.course.findFirst({
      where: { id: body.courseId, userId: req.userId },
      select: { id: true },
    });
    if (!course) {
      return reply.status(404).send({ error: 'course_not_found' });
    }

    const created = await prisma.typingSession.create({
      data: {
        courseId: body.courseId,
        userId: req.userId,
        startedAt: new Date(body.startedAt),
        endedAt: new Date(body.endedAt),
        durationSec: body.durationSec,
        charCount: body.charCount,
        errorCount: body.errorCount,
        wpm: body.wpm,
        accuracy: body.accuracy,
        loopCount: body.loopCount,
        pasteRanges: body.pasteRanges,
      },
    });

    return reply.status(201).send({
      id: created.id,
      courseId: created.courseId,
      userId: created.userId,
      startedAt: created.startedAt.toISOString(),
      endedAt: created.endedAt.toISOString(),
      durationSec: created.durationSec,
      charCount: created.charCount,
      errorCount: created.errorCount,
      wpm: created.wpm,
      accuracy: created.accuracy,
      loopCount: created.loopCount,
      pasteRanges: created.pasteRanges,
      createdAt: created.createdAt.toISOString(),
    });
  });

  app.get<{ Querystring: { courseId?: string } }>('/sessions', async (req) => {
    const list = await prisma.typingSession.findMany({
      where: {
        userId: req.userId,
        ...(req.query.courseId ? { courseId: req.query.courseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return list.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      userId: s.userId,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt.toISOString(),
      durationSec: s.durationSec,
      charCount: s.charCount,
      errorCount: s.errorCount,
      wpm: s.wpm,
      accuracy: s.accuracy,
      loopCount: s.loopCount,
      pasteRanges: s.pasteRanges,
      createdAt: s.createdAt.toISOString(),
    }));
  });
}
