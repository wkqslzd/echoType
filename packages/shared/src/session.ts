import { z } from 'zod';
import { CourseStatsDTO } from './courseStats.js';

export const PasteRange = z.object({
  start: z.number().int().nonnegative(),
  length: z.number().int().positive(),
});
export type PasteRange = z.infer<typeof PasteRange>;

export const CreateSessionInput = z.object({
  courseId: z.string().cuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSec: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  wpm: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
  loopCount: z.number().int().nonnegative().default(0),
  pasteRanges: z.array(PasteRange).default([]),
});
export type CreateSessionInput = z.infer<typeof CreateSessionInput>;

export const SessionDTO = z.object({
  id: z.string(),
  courseId: z.string(),
  userId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSec: z.number(),
  charCount: z.number(),
  errorCount: z.number(),
  wpm: z.number(),
  accuracy: z.number(),
  loopCount: z.number(),
  pasteRanges: z.array(PasteRange),
  createdAt: z.string(),
});
export type SessionDTO = z.infer<typeof SessionDTO>;

export const CreateSessionResponse = z.object({
  session: SessionDTO,
  courseStats: CourseStatsDTO,
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;
