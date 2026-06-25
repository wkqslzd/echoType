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
import { findModeLastPracticedCourse, modeLastPracticeCategoryIds } from '../modeLastPractice.js';

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

function listCategoriesOrderBy(
  sort: CourseListSort,
): Prisma.CategoryOrderByWithRelationInput | Prisma.CategoryOrderByWithRelationInput[] {
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

function isStatsSort(sort: CourseListSort): boolean {
  return (
    sort === 'loopCount_desc' || sort === 'totalDuration_desc' || sort === 'lastPracticed_desc'
  );
}

function compareLastPracticedDesc(a: Date | null, b: Date | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.getTime() - a.getTime();
}

/** Prisma cannot order Category by member sum/max; sort in memory using rollup. */
function sortCategoriesByStats(
  categories: CategoryWithRollup[],
  sort: CourseListSort,
): CategoryWithRollup[] {
  const copy = [...categories];
  copy.sort((a, b) => {
    const ra = categoryRollupFromMembers(a.courses);
    const rb = categoryRollupFromMembers(b.courses);
    let cmp = 0;
    switch (sort) {
      case 'loopCount_desc':
        cmp = rb.totalCompletedPasses - ra.totalCompletedPasses;
        break;
      case 'totalDuration_desc':
        cmp = rb.totalDurationSec - ra.totalDurationSec;
        break;
      case 'lastPracticed_desc':
        cmp = compareLastPracticedDesc(
          ra.lastPracticedAt ? new Date(ra.lastPracticedAt) : null,
          rb.lastPracticedAt ? new Date(rb.lastPracticedAt) : null,
        );
        break;
    }
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name);
  });
  return copy;
}

function serializeCategory(category: CategoryWithRollup, lastPracticeHere: boolean) {
  return {
    id: category.id,
    name: category.name,
    mode: category.mode,
    description: category.description,
    courseCount: category._count.courses,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    rollup: categoryRollupFromMembers(category.courses),
    lastPracticeHere,
  };
}

async function lastPracticeHereForCategory(
  userId: string,
  category: CategoryWithRollup,
  winnerCategoryByMode?: Map<string, string | null>,
) {
  const winnerCategoryId =
    winnerCategoryByMode?.get(category.mode) ??
    (await findModeLastPracticedCourse(userId, category.mode))?.categoryId ??
    null;
  return winnerCategoryId != null && winnerCategoryId === category.id;
}

export async function registerCategoryRoutes(app: FastifyInstance) {
  app.get('/categories', async (req) => {
    const query = ListCategoriesQuery.parse(req.query);
    const q = query.q?.trim() || undefined;
    const sort = query.sort ?? 'createdAt_desc';
    let categories = await prisma.category.findMany({
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
    if (isStatsSort(sort)) {
      categories = sortCategoriesByStats(categories, sort);
    }
    const winnerByMode = await modeLastPracticeCategoryIds(
      req.userId,
      categories.map((c) => c.mode),
    );
    return categories.map((c) => {
      const winnerCategoryId = winnerByMode.get(c.mode) ?? null;
      const lastPracticeHere = winnerCategoryId != null && winnerCategoryId === c.id;
      return serializeCategory(c, lastPracticeHere);
    });
  });

  app.get<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: categoryInclude,
    });
    if (!category) {
      return reply.status(404).send({ error: 'not_found' });
    }
    const lastPracticeHere = await lastPracticeHereForCategory(req.userId, category);
    return serializeCategory(category, lastPracticeHere);
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
      const lastPracticeHere = await lastPracticeHereForCategory(req.userId, created);
      return reply.status(201).send(serializeCategory(created, lastPracticeHere));
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
      const lastPracticeHere = await lastPracticeHereForCategory(req.userId, updated);
      return serializeCategory(updated, lastPracticeHere);
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
