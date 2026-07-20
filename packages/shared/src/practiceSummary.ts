import { z } from 'zod';

export const PracticeSummaryDTO = z.object({
  totalDurationSec: z.number().int().nonnegative(),
  totalCompletedPasses: z.number().int().nonnegative(),
  lastSavedAt: z.string().datetime().nullable(),
  hasSessions: z.boolean(),
});
export type PracticeSummaryDTO = z.infer<typeof PracticeSummaryDTO>;
