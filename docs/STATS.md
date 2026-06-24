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

Code: `packages/shared/src/courseStats.ts`, `apps/api/src/courseStats.ts`.

## 4. Collection rollup (on `Category`)

**Static (not from typing):** `createdAt`, `updatedAt` (collection metadata edits only), `courseCount`.

**Rollup from member courses** (recomputed when any member’s cumulative changes):

| Field | Definition |
|-------|------------|
| `rollupDurationSec` | `sum(member.totalDurationSec)` |
| `rollupCompletedPasses` | `sum(member.totalCompletedPasses)` |
| `rollupLastPracticedAt` | `max(member.lastPracticedAt)` over members; `null` if all null |

Empty collection: rollups `0` / `0` / `null`.

## 5. List sort keys (stats-based)

| Sort key | Orders by |
|----------|-----------|
| `loopCount_desc` | `totalCompletedPasses` descending |
| `totalDuration_desc` | `totalDurationSec` descending |
| `lastPracticed_desc` | `lastPracticedAt` descending, nulls last |

Non-stats sorts (`createdAt_*`, `updatedAt_desc`, `title_asc`) use `Course` metadata only — see ADR-0012.

## 6. Calculation edge cases

| Condition | Effect |
|-----------|--------|
| `target.length === 0` | No completed passes; `progress = 0`. |
| `charCount === 0` at persist | `accuracy = 1`, `wpm = 0`. |
| `durationSec === 0` at persist | `wpm = 0`. |
| Multiple session rows per course | Cumulative sums/counts include all rows. |
| Course deleted | Session rows removed (cascade); cumulative destroyed with course. |
