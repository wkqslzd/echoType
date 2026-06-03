import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Annotation, Course, Prisma } from '@prisma/client';
import {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesQuery,
  CourseMode,
  type AnnotationInput,
  deriveAnchoredText,
  validateAnnotations,
} from '@echotype/shared';
import { prisma } from '../prisma.js';

type CourseWithAnnotations = Course & { annotations: Annotation[] };

function serializeCourse(course: CourseWithAnnotations) {
  return {
    id: course.id,
    title: course.title,
    content: course.content,
    mode: course.mode,
    categoryId: course.categoryId,
    annotations: course.annotations
      .slice()
      .sort((a, b) => a.startIndex - b.startIndex)
      .map((a) => ({
        id: a.id,
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        noteText: a.noteText,
        anchoredText: a.anchoredText,
      })),
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

// Business-rule check that depends on content (overlap, bounds, whitespace
// anchors). Shape was already validated by Zod. Returns true if it replied 422.
function rejectInvalidAnnotations(
  reply: FastifyReply,
  content: string,
  annotations: AnnotationInput[],
): boolean {
  const issues = validateAnnotations(content, annotations);
  if (issues.length > 0) {
    reply.status(422).send({ error: 'annotation_validation_error', issues });
    return true;
  }
  return false;
}

// Server derives anchoredText from the current content so the stored snapshot is
// always the source of truth for the later re-anchor check; the client value (if
// any) is ignored.
function toAnnotationRows(content: string, annotations: AnnotationInput[]) {
  return annotations.map((a) => ({
    startIndex: a.startIndex,
    endIndex: a.endIndex,
    noteText: a.noteText,
    anchoredText: deriveAnchoredText(content, a.startIndex, a.endIndex),
  }));
}

export async function registerCourseRoutes(app: FastifyInstance) {
  app.get('/courses', async (req) => {
    const query = ListCoursesQuery.parse(req.query);
    const courses = await prisma.course.findMany({
      where: {
        userId: req.userId,
        ...(query.mode ? { mode: query.mode } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { annotations: true },
    });
    return courses.map(serializeCourse);
  });

  app.get<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { annotations: true },
    });
    if (!course) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return serializeCourse(course);
  });

  app.post('/courses', async (req, reply) => {
    const body = CreateCourseInput.parse(req.body);
    if (rejectInvalidAnnotations(reply, body.content, body.annotations)) return;

    const created = await prisma.course.create({
      data: {
        userId: req.userId,
        title: body.title,
        content: body.content,
        mode: body.mode as CourseMode,
        categoryId: body.categoryId ?? null,
        annotations: { create: toAnnotationRows(body.content, body.annotations) },
      },
      include: { annotations: true },
    });
    return reply.status(201).send(serializeCourse(created));
  });

  app.put<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const body = UpdateCourseInput.parse(req.body);
    if (rejectInvalidAnnotations(reply, body.content, body.annotations)) return;

    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }

    // Atomic replace: update scalar fields and swap the entire annotation set in
    // one transaction so a course is never persisted with a stale/partial set.
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.annotation.deleteMany({ where: { courseId: existing.id } });
      return tx.course.update({
        where: { id: existing.id },
        data: {
          title: body.title,
          content: body.content,
          mode: body.mode as CourseMode,
          categoryId: body.categoryId ?? null,
          annotations: { create: toAnnotationRows(body.content, body.annotations) },
        },
        include: { annotations: true },
      });
    });
    return reply.send(serializeCourse(updated));
  });
}
