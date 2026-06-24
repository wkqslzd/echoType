import { z } from 'zod';

export const CourseStatsDTO = z.object({
  totalDurationSec: z.number().int().nonnegative(),
  totalCompletedPasses: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  lastPracticedAt: z.string().datetime().nullable(),
  avgWpm: z.number().nonnegative().nullable(),
  avgAccuracy: z.number().min(0).max(1).nullable(),
});
export type CourseStatsDTO = z.infer<typeof CourseStatsDTO>;

/** DB row fields used to derive {@link CourseStatsDTO} (see docs/STATS.md §3). */
export type CourseStatsRow = {
  totalDurationSec: number;
  totalCompletedPasses: number;
  sessionCount: number;
  totalCharCount: number;
  totalWpmCharSum: number;
  totalAccCharSum: number;
  lastPracticedAt: Date | string | null;
};

export function courseStatsFromRow(row: CourseStatsRow): CourseStatsDTO {
  const avgWpm = row.totalCharCount > 0 ? row.totalWpmCharSum / row.totalCharCount : null;
  const avgAccuracy = row.totalCharCount > 0 ? row.totalAccCharSum / row.totalCharCount : null;
  const lastPracticedAt =
    row.lastPracticedAt == null
      ? null
      : typeof row.lastPracticedAt === 'string'
        ? row.lastPracticedAt
        : row.lastPracticedAt.toISOString();

  return {
    totalDurationSec: row.totalDurationSec,
    totalCompletedPasses: row.totalCompletedPasses,
    sessionCount: row.sessionCount,
    lastPracticedAt,
    avgWpm: avgWpm != null ? Number(avgWpm.toFixed(2)) : null,
    avgAccuracy: avgAccuracy != null ? Number(avgAccuracy.toFixed(4)) : null,
  };
}
