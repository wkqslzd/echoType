# EchoType — Stats Metrics Reference

> Static definitions and formulas for statistical fields only.  
> UX flows, persistence policy, phases, and tags → `docs/STATE.md` / `docs/DECISIONS.md`.  
> Primitives: ADR-0006 (charCount), ADR-0007 (newline sync). Code: `apps/web/src/lib/typingAlign.ts`.

## 1. Primitives

### 1.1 Alignment

Typing stats use **aligned** comparison between user input (`typed`) and course `content` (`target`):

- `syncTypedToTarget(typed, target)` — maps keystrokes to target indices; auto-skips target `\n` when the user did not type Enter (ADR-0007).
- `countAlignedErrors(typed, target)` — character mismatches under the same skip rules.
- `alignedProgress(typed, target)` — `targetCursor / target.length` where `targetCursor` comes from sync; `0` if `target.length === 0`.

### 1.2 Completed pass (loop)

A **completed pass** is when `isPassComplete(typed, target)` is true:

- `target.length > 0`
- `syncTypedToTarget(typed, target).complete`

Accuracy does not affect completion. Partial input is never a completed pass.

On each completed pass (auto-loop):

1. `loopCount` increases by 1.
2. That pass’s aligned error count adds to the running session `errorCount` (ADR-0006).
3. `typed` resets for the next pass.

API/DB field name: `loopCount`. UI label: **loops**.

### 1.3 Active time

`activeMs` — milliseconds counted toward session duration on the typing page. Increments in fixed ticks only while the user is **active** (no keystroke/paste for ≥ 5s stops the clock).  
`durationSec = max(0, round(activeMs / 1000))`.

## 2. `TypingSession` row (per persisted session)

One DB row per persisted session. Field definitions at persist time:

| Field | Type | Definition |
|-------|------|------------|
| `startedAt` | datetime | Timestamp of the first keystroke in this session record. |
| `endedAt` | datetime | Timestamp when the session record is persisted. |
| `durationSec` | int | §1.3 from `startedAt`…`endedAt` activity window. |
| `charCount` | int | Monotonic count of characters **added** to the aligned buffer; backspace does not decrease (ADR-0006). |
| `errorCount` | int | Sum of `countAlignedErrors` at each completed pass in this record, plus aligned errors in any trailing partial buffer at persist time. |
| `accuracy` | float [0,1] | `1 - errorCount / charCount` if `charCount > 0`, else `1`. |
| `wpm` | float | `charCount / 5 / (durationSec / 60)` if `durationSec > 0`, else `0`. Standard WPM: 5 characters per word. |
| `loopCount` | int | Completed passes (§1.2) in this session record. |
| `pasteRanges` | json | `{ start, length }[]` — paste spans in the aligned buffer for this record. |

### 2.1 Live vs persisted (same formulas)

While typing, the stats bar uses the **same formulas** on the current in-memory counters:

| Live label | Formula | Notes |
|------------|---------|-------|
| time | §1.3 | |
| wpm | §2 `wpm` | Uses session `charCount` and current `durationSec`. |
| accuracy | `1 - errors / typed.length` if `typed.length > 0`, else `1` | **Current pass only**; resets each auto-loop. Differs from persisted `accuracy` (§2). |
| progress | `alignedProgress(typed, target)` | In-progress attempt only; not a stored field. |
| errors | `countAlignedErrors(typed, target)` | Current pass only. |
| loops | `loopCount` | Completed passes only; not `loopCount + 1`. |

Persist snapshots §2 fields into `TypingSession`.

## 3. Course cumulative (on `Course`)

Materialized on the `courses` table. Updated atomically (increment) when a new `TypingSession` row is inserted. Exposed as `CourseDTO.stats` (`CourseStatsDTO`).

| Field (API / `CourseStatsDTO`) | DB column | Definition |
|-------------------------------|-----------|------------|
| `totalDurationSec` | `totalDurationSec` | `sum(durationSec)` |
| `totalCompletedPasses` | `totalCompletedPasses` | `sum(loopCount)` |
| `sessionCount` | `sessionCount` | `count(*)` of session rows |
| `lastPracticedAt` | `lastPracticedAt` | `max(endedAt)`; `null` if no sessions |
| `avgWpm` | *(derived)* | `totalWpmCharSum / totalCharCount` if `totalCharCount > 0`, else `null` |
| `avgAccuracy` | *(derived)* | `totalAccCharSum / totalCharCount` if `totalCharCount > 0`, else `null` |

**Internal storage only** (not in `CourseStatsDTO`; incremented per saved session):

| Column | Increment per session |
|--------|-------------------------|
| `totalCharCount` | `+ charCount` |
| `totalWpmCharSum` | `+ wpm × charCount` |
| `totalAccCharSum` | `+ accuracy × charCount` |

`Course.updatedAt` is **last course edit** (content/title/annotations), not `lastPracticedAt`.

Default when no sessions: `totalDurationSec = 0`, `totalCompletedPasses = 0`, `sessionCount = 0`, `lastPracticedAt = null`, averages `null`.

**Read-time tag (not stored):** `CourseDTO.lastPracticeHere` — `true` when this course is the mode-wide winner: max `lastPracticedAt` (tie-break smallest `courseId`). At most one per mode per user.

Code: `packages/shared/src/courseStats.ts`, `apps/api/src/courseStats.ts`, `apps/api/src/modeLastPractice.ts`.

## 4. Collection rollup (on `Category`)

**Static (not from typing):** `createdAt`, `updatedAt` (collection metadata edits only), `courseCount`.

**Rollup from member courses** (recomputed on each `GET/POST/PUT /categories` from member course cumulative columns):

| Concept (STATS) | `CategoryDTO.rollup` field | Definition |
|-----------------|----------------------------|------------|
| `rollupDurationSec` | `totalDurationSec` | `sum(member.totalDurationSec)` |
| `rollupCompletedPasses` | `totalCompletedPasses` | `sum(member.totalCompletedPasses)` |
| `rollupLastPracticedAt` | `lastPracticedAt` | `max(member.lastPracticedAt)` over members; `null` if all null |

Empty collection: `rollup` is `{ totalDurationSec: 0, totalCompletedPasses: 0, lastPracticedAt: null }`.

**Read-time tag (not stored):** `CategoryDTO.lastPracticeHere` — `true` when the mode-wide last-practiced course’s `categoryId` equals this collection’s `id`.

Code: `packages/shared/src/categoryRollup.ts`, `apps/api/src/routes/categories.ts`.

## 5. List sort keys (stats-based)

| Sort key | Orders by | Tie-break |
|----------|-----------|-----------|
| `loopCount_desc` | `totalCompletedPasses` descending | `title` ascending (courses); `name` ascending (collections) |
| `totalDuration_desc` | `totalDurationSec` descending | same |
| `lastPracticed_desc` | `lastPracticedAt` descending, nulls last | same |

**Implementation:** `GET /courses` uses materialized columns + DB `orderBy`. `GET /categories`
stats sorts order by member rollup (`categoryRollupFromMembers`) **in memory** after fetch
(Prisma cannot aggregate orderBy on relation sum/max for Category).

Non-stats sorts (`createdAt_*`, `updatedAt_desc`, `title_asc`) use `Course` / `Category`
metadata only — see ADR-0012. Sort preference: localStorage keys `echotype.courseListSort.list.v1`
(mode list) and `echotype.courseListSort.detail.v1` (collection detail), per SHORT/ARTICLE.

## 6. Card face display (explicit stats line)

Used on course cards and collection list cards. Code: `packages/shared/src/practiceDisplay.ts`.

| Helper | Output |
|--------|--------|
| `formatCardDuration(sec)` | `0m` if &lt; 1 min; else `Nm`, `Nh`, or `Nh Mm` (floor minutes within hour) |
| `formatLoopCount(n)` | `N loop` / `N loops` |
| `formatCardStatsLine(duration, passes)` | `{duration} · {loops}` e.g. `2h 15m · 12 loops` |

Collection list card appends rollup to course count: `{courseCount} courses · {stats line}`.

## 7. Calculation edge cases

| Condition | Effect |
|-----------|--------|
| `target.length === 0` | No completed passes; `progress = 0`. |
| `charCount === 0` at persist | `accuracy = 1`, `wpm = 0`. |
| `durationSec === 0` at persist | `wpm = 0`. |
| Multiple session rows per course | Cumulative sums/counts include all rows. |
| Course deleted | Session rows removed (cascade); cumulative destroyed with course. |
