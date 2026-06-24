import type { Course } from '@prisma/client';
import { courseStatsFromRow, type CourseStatsDTO } from '@echotype/shared';

export type CourseWithStatsFields = Pick<
  Course,
  | 'totalDurationSec'
  | 'totalCompletedPasses'
  | 'sessionCount'
  | 'totalCharCount'
  | 'totalWpmCharSum'
  | 'totalAccCharSum'
  | 'lastPracticedAt'
>;

export function serializeCourseStats(course: CourseWithStatsFields): CourseStatsDTO {
  return courseStatsFromRow({
    totalDurationSec: course.totalDurationSec,
    totalCompletedPasses: course.totalCompletedPasses,
    sessionCount: course.sessionCount,
    totalCharCount: course.totalCharCount,
    totalWpmCharSum: course.totalWpmCharSum,
    totalAccCharSum: course.totalAccCharSum,
    lastPracticedAt: course.lastPracticedAt,
  });
}

export function serializeSession(session: {
  id: string;
  courseId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  charCount: number;
  errorCount: number;
  wpm: number;
  accuracy: number;
  loopCount: number;
  pasteRanges: unknown;
  createdAt: Date;
}) {
  return {
    id: session.id,
    courseId: session.courseId,
    userId: session.userId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt.toISOString(),
    durationSec: session.durationSec,
    charCount: session.charCount,
    errorCount: session.errorCount,
    wpm: session.wpm,
    accuracy: session.accuracy,
    loopCount: session.loopCount,
    pasteRanges: session.pasteRanges,
    createdAt: session.createdAt.toISOString(),
  };
}
