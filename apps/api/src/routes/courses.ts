import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Annotation, Course, Prisma } from '@prisma/client';
import {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesQuery,
  PatchCoursesCategoryInput,
  CheckCourseTitleQuery,
  CourseMode,
  type CourseListSort,
  type AnnotationInput,
  type CourseMode as CourseModeType,
  deriveAnchoredText,
  formatContentIssueMessage,
  prepareCourseContent,
  validateAnnotations,
  validateMode,
} from '@echotype/shared';
import { prisma } from '../prisma.js';
import { toOptionalDescription } from '../text.js';
import { isUniqueConstraintViolation } from '../prismaErrors.js';
import { serializeCourseStats } from '../courseStats.js';

type CourseWithAnnotations = Course & {
  annotations: Annotation[];
  category?: { name: string } | null;
};

function serializeCourse(course: CourseWithAnnotations) {
  return {
    id: course.id,
    title: course.title,
    content: course.content,
    mode: course.mode,
    categoryId: course.categoryId,
    categoryName: course.category?.name ?? null,
    description: course.description,
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
    stats: serializeCourseStats(course),
  };
}

// Line-ending normalization + control-character filter. Returns normalized content
// or replies 422. Shape was already validated by Zod.
function rejectInvalidContent(
  reply: FastifyReply,
  rawContent: string,
): { ok: true; content: string } | { ok: false } {
  const { content, issue } = prepareCourseContent(rawContent);
  if (issue) {
    reply.status(422).send({
      error: 'content_validation_error',
      issues: [{ ...issue, message: formatContentIssueMessage(issue) }],
    });
    return { ok: false };
  }
  return { ok: true, content };
}

// Mode-length business rule. Shape was already validated by Zod; this rejects a
// well-formed payload whose content length violates the chosen mode with 422,
// the same class as annotation rules. Returns true if it replied 422.
function rejectInvalidMode(
  reply: FastifyReply,
  content: string,
  mode: CourseModeType,
): boolean {
  const issue = validateMode(content, mode);
  if (issue) {
    reply.status(422).send({ error: 'mode_length_violation', issues: [issue] });
    return true;
  }
  return false;
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

function listCoursesOrderBy(sort: CourseListSort): Prisma.CourseOrderByWithRelationInput {
  switch (sort) {
    case 'createdAt_asc':
      return { createdAt: 'asc' };
    case 'updatedAt_desc':
      return { updatedAt: 'desc' };
    case 'title_asc':
      return { title: 'asc' };
    default:
      return { createdAt: 'desc' };
  }
}

export async function registerCourseRoutes(app: FastifyInstance) {
  app.get('/courses/title-available', async (req) => {
    const query = CheckCourseTitleQuery.parse(req.query);
    const existing = await prisma.course.findFirst({
      where: {
        userId: req.userId,
        mode: query.mode,
        title: query.title,
        ...(query.excludeId ? { NOT: { id: query.excludeId } } : {}),
      },
      select: { id: true },
    });
    return { available: !existing };
  });

  app.get('/courses', async (req) => {
    const query = ListCoursesQuery.parse(req.query);
    const q = query.q?.trim() || undefined;
    const sort = query.sort ?? 'createdAt_desc';
    const courses = await prisma.course.findMany({
      where: {
        userId: req.userId,
        ...(query.mode ? { mode: query.mode } : {}),
        ...(query.categoryId === 'null'
          ? { categoryId: null }
          : query.categoryId
            ? { categoryId: query.categoryId }
            : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                {
                  annotations: {
                    some: { noteText: { contains: q, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: listCoursesOrderBy(sort),
      include: { annotations: true, category: { select: { name: true } } },
    });
    return courses.map(serializeCourse);
  });

  app.get<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { annotations: true, category: { select: { name: true } } },
    });
    if (!course) {
      return reply.status(410).send({ error: 'not_found' });
    }
    return serializeCourse(course);
  });

  app.post('/courses', async (req, reply) => {
    const body = CreateCourseInput.parse(req.body);
    const contentCheck = rejectInvalidContent(reply, body.content);
    if (!contentCheck.ok) return;
    const content = contentCheck.content;
    if (rejectInvalidMode(reply, content, body.mode as CourseModeType)) return;
    if (rejectInvalidAnnotations(reply, content, body.annotations)) return;

    try {
      const created = await prisma.course.create({
        data: {
          userId: req.userId,
          title: body.title,
          content,
          mode: body.mode as CourseMode,
          categoryId: body.categoryId ?? null,
          description: toOptionalDescription(body.description),
          annotations: { create: toAnnotationRows(content, body.annotations) },
        },
        include: { annotations: true, category: { select: { name: true } } },
      });
      return reply.status(201).send(serializeCourse(created));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return reply.status(409).send({ error: 'duplicate_course_title' });
      }
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const body = UpdateCourseInput.parse(req.body);
    const contentCheck = rejectInvalidContent(reply, body.content);
    if (!contentCheck.ok) return;
    const content = contentCheck.content;
    if (rejectInvalidMode(reply, content, body.mode as CourseModeType)) return;
    if (rejectInvalidAnnotations(reply, content, body.annotations)) return;

    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }

    // Atomic replace: update scalar fields and swap the entire annotation set in
    // one transaction so a course is never persisted with a stale/partial set.
    try {
      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.annotation.deleteMany({ where: { courseId: existing.id } });
        return tx.course.update({
          where: { id: existing.id },
          data: {
            title: body.title,
            content,
            mode: body.mode as CourseMode,
            categoryId: body.categoryId ?? null,
            description: toOptionalDescription(body.description),
            annotations: { create: toAnnotationRows(content, body.annotations) },
          },
          include: { annotations: true, category: { select: { name: true } } },
        });
      });
      return reply.send(serializeCourse(updated));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return reply.status(409).send({ error: 'duplicate_course_title' });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>('/courses/:id', async (req, reply) => {
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }
    await prisma.course.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  app.patch('/courses/category', async (req, reply) => {
    const body = PatchCoursesCategoryInput.parse(req.body);
    const uniqueIds = [...new Set(body.courseIds)];
    if (uniqueIds.length !== body.courseIds.length) {
      return reply.status(422).send({ error: 'duplicate_course_ids' });
    }

    const courses = await prisma.course.findMany({
      where: { id: { in: uniqueIds }, userId: req.userId },
      select: { id: true, mode: true, categoryId: true },
    });
    if (courses.length !== uniqueIds.length) {
      return reply.status(404).send({ error: 'course_not_found' });
    }

    const modes = new Set(courses.map((c) => c.mode));
    if (modes.size !== 1) {
      return reply.status(422).send({ error: 'mixed_modes' });
    }
    const mode = courses[0]!.mode;

    if (body.categoryId === null) {
      const sourceIds = new Set(courses.map((c) => c.categoryId));
      if (sourceIds.size !== 1 || sourceIds.has(null)) {
        return reply.status(422).send({ error: 'courses_not_in_same_collection' });
      }
      await prisma.course.updateMany({
        where: { id: { in: uniqueIds }, userId: req.userId },
        data: { categoryId: null },
      });
      return { updated: uniqueIds.length };
    }

    const target = await prisma.category.findFirst({
      where: { id: body.categoryId, userId: req.userId },
      select: { id: true, mode: true },
    });
    if (!target) {
      return reply.status(404).send({ error: 'category_not_found' });
    }
    if (target.mode !== mode) {
      return reply.status(422).send({ error: 'mode_mismatch' });
    }

    const categoryIds = new Set(courses.map((c) => c.categoryId));

    if (categoryIds.size === 1 && categoryIds.has(null)) {
      await prisma.course.updateMany({
        where: { id: { in: uniqueIds }, userId: req.userId },
        data: { categoryId: target.id },
      });
      return { updated: uniqueIds.length };
    }

    if (categoryIds.size === 1 && !categoryIds.has(null)) {
      const sourceId = [...categoryIds][0]!;
      if (sourceId === target.id) {
        return { updated: 0 };
      }
      await prisma.course.updateMany({
        where: { id: { in: uniqueIds }, userId: req.userId },
        data: { categoryId: target.id },
      });
      return { updated: uniqueIds.length };
    }

    return reply.status(422).send({ error: 'invalid_category_transition' });
  });
}
