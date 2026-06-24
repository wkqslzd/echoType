import { z } from 'zod';

export const CategoryRollupDTO = z.object({
  totalDurationSec: z.number().int().nonnegative(),
  totalCompletedPasses: z.number().int().nonnegative(),
  lastPracticedAt: z.string().datetime().nullable(),
});
export type CategoryRollupDTO = z.infer<typeof CategoryRollupDTO>;

/** Member course cumulative fields used for collection rollup (docs/STATS.md §4). */
export type CategoryRollupMember = {
  totalDurationSec: number;
  totalCompletedPasses: number;
  lastPracticedAt: Date | string | null;
};

export function categoryRollupFromMembers(members: CategoryRollupMember[]): CategoryRollupDTO {
  let totalDurationSec = 0;
  let totalCompletedPasses = 0;
  let lastPracticedAt: string | null = null;

  for (const member of members) {
    totalDurationSec += member.totalDurationSec;
    totalCompletedPasses += member.totalCompletedPasses;
    if (member.lastPracticedAt == null) continue;
    const iso =
      typeof member.lastPracticedAt === 'string'
        ? member.lastPracticedAt
        : member.lastPracticedAt.toISOString();
    if (lastPracticedAt === null || iso > lastPracticedAt) {
      lastPracticedAt = iso;
    }
  }

  return { totalDurationSec, totalCompletedPasses, lastPracticedAt };
}
