import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
  categoryRollupFromMembers,
  type CourseListSort,
} from '@echotype/shared';
import { prisma } from '../prisma.js';
import { toOptionalDescription } from '../text.js';
import { isUniqueConstraintViolation } from '../prismaErrors.js';

const categoryInclude = {
  _count: { select: { courses: true } },
  courses: {
    select: {
      totalDurationSec: true,
      totalCompletedPasses: true,
      lastPracticedAt: true,
    },
  },
} satisfies Prisma.CategoryInclude;

type CategoryWithRollup = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

function listCategoriesOrderBy(sort: CourseListSort): Prisma.CategoryOrderByWithRelationInput {
  switch (sort) {
    case 'createdAt_asc':
      return { createdAt: 'asc' };
    case 'updatedAt_desc':
      return { updatedAt: 'desc' };
    case 'title_asc':
      return { name: 'asc' };
    default:
      return { createdAt: 'desc' };
  }
}

function serializeCategory(category: CategoryWithRollup) {
  return {
    id: category.id,
    name: category.name,
    mode: category.mode,
    description: category.description,
    courseCount: category._count.courses,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    rollup: categoryRollupFromMembers(category.courses),
  };
}

export async function registerCategoryRoutes(app: FastifyInstance) {
  app.get('/categories', async (req) => {
    const query = ListCategoriesQuery.parse(req.query);
    const q = query.q?.trim() || undefined;
    const sort = query.sort ?? 'createdAt_desc';
    const categories = await prisma.category.findMany({
      where: {
        userId: req.userId,
        ...(query.mode ? { mode: query.mode } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: listCategoriesOrderBy(sort),
      include: categoryInclude,
    });
    return categories.map(serializeCategory);
  });

  app.get<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: categoryInclude,
    });
    if (!category) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return serializeCategory(category);
  });

  app.post('/categories', async (req, reply) => {
    const body = CreateCategoryInput.parse(req.body);
    try {
      const created = await prisma.category.create({
        data: {
          userId: req.userId,
          name: body.name,
          mode: body.mode,
          description: toOptionalDescription(body.description),
        },
        include: categoryInclude,
      });
      return reply.status(201).send(serializeCategory(created));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return reply.status(409).send({ error: 'duplicate_collection_name' });
      }
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const body = UpdateCategoryInput.parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }
    try {
      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          description: toOptionalDescription(body.description),
        },
        include: categoryInclude,
      });
      return serializeCategory(updated);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return reply.status(409).send({ error: 'duplicate_collection_name' });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }
    await prisma.category.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
}
