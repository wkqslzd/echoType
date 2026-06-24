-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "totalDurationSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCompletedPasses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCharCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWpmCharSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAccCharSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lastPracticedAt" TIMESTAMP(3);

-- Backfill cumulative stats from existing typing sessions
UPDATE "courses" c
SET
  "totalDurationSec" = COALESCE(s.sum_duration, 0),
  "totalCompletedPasses" = COALESCE(s.sum_loops, 0),
  "sessionCount" = COALESCE(s.cnt, 0),
  "totalCharCount" = COALESCE(s.sum_chars, 0),
  "totalWpmCharSum" = COALESCE(s.sum_wpm_char, 0),
  "totalAccCharSum" = COALESCE(s.sum_acc_char, 0),
  "lastPracticedAt" = s.max_ended
FROM (
  SELECT
    "courseId",
    SUM("durationSec")::INTEGER AS sum_duration,
    SUM("loopCount")::INTEGER AS sum_loops,
    COUNT(*)::INTEGER AS cnt,
    SUM("charCount")::INTEGER AS sum_chars,
    SUM("wpm" * "charCount") AS sum_wpm_char,
    SUM("accuracy" * "charCount") AS sum_acc_char,
    MAX("endedAt") AS max_ended
  FROM "typing_sessions"
  GROUP BY "courseId"
) s
WHERE c.id = s."courseId";

-- CreateIndex
CREATE INDEX "courses_userId_mode_lastPracticedAt_idx" ON "courses"("userId", "mode", "lastPracticedAt");

-- CreateIndex
CREATE INDEX "courses_userId_mode_totalCompletedPasses_idx" ON "courses"("userId", "mode", "totalCompletedPasses");

-- CreateIndex
CREATE INDEX "courses_userId_mode_totalDurationSec_idx" ON "courses"("userId", "mode", "totalDurationSec");
