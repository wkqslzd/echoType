import type { FastifyInstance } from 'fastify';
import { CreateSessionInput } from '@echotype/shared';
import { prisma } from '../prisma.js';
import { serializeCourseStats, serializeSession } from '../courseStats.js';

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

    const endedAt = new Date(body.endedAt);
    const wpmChar = body.wpm * body.charCount;
    const accChar = body.accuracy * body.charCount;

    const { created, updatedCourse } = await prisma.$transaction(async (tx) => {
      const created = await tx.typingSession.create({
        data: {
          courseId: body.courseId,
          userId: req.userId,
          startedAt: new Date(body.startedAt),
          endedAt,
          durationSec: body.durationSec,
          charCount: body.charCount,
          errorCount: body.errorCount,
          wpm: body.wpm,
          accuracy: body.accuracy,
          loopCount: body.loopCount,
          pasteRanges: body.pasteRanges,
        },
      });

      const updatedCourse = await tx.course.update({
        where: { id: body.courseId },
        data: {
          totalDurationSec: { increment: body.durationSec },
          totalCompletedPasses: { increment: body.loopCount },
          sessionCount: { increment: 1 },
          totalCharCount: { increment: body.charCount },
          totalWpmCharSum: { increment: wpmChar },
          totalAccCharSum: { increment: accChar },
          lastPracticedAt: endedAt,
        },
      });

      return { created, updatedCourse };
    });

    return reply.status(201).send({
      session: serializeSession(created),
      courseStats: serializeCourseStats(updatedCourse),
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
    return list.map((s) => serializeSession(s));
  });
}
