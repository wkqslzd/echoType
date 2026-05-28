import type { FastifyInstance } from 'fastify';
import { CreateCourseInput, ListCoursesQuery, CourseMode } from '@echotype/shared';
import { prisma } from '../prisma.js';

export async function registerCourseRoutes(app: FastifyInstance) {
  app.get('/courses', async (req) => {
    const query = ListCoursesQuery.parse(req.query);
    const courses = await prisma.course.findMany({
      where: {
        userId: req.userId,
        ...(query.mode ? { mode: query.mode } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return courses.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      mode: c.mode,
      categoryId: c.categoryId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  });

  app.get<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!course) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return {
      id: course.id,
      title: course.title,
      content: course.content,
      mode: course.mode,
      categoryId: course.categoryId,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    };
  });

  app.post('/courses', async (req, reply) => {
    const body = CreateCourseInput.parse(req.body);
    const created = await prisma.course.create({
      data: {
        userId: req.userId,
        title: body.title,
        content: body.content,
        mode: body.mode as CourseMode,
        categoryId: body.categoryId ?? null,
      },
    });
    return reply.status(201).send({
      id: created.id,
      title: created.title,
      content: created.content,
      mode: created.mode,
      categoryId: created.categoryId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  });
}
