import { z } from 'zod';

export const CourseMode = z.enum(['SHORT', 'ARTICLE']);
export type CourseMode = z.infer<typeof CourseMode>;

// Short and Article ranges intentionally OVERLAP (200-500). Mode is the user's
// own classification of "is this a self-contained piece?", not a hard size cut,
// so a 350-char text can legitimately be either. Each mode is validated only
// against its own [min, max]; the two are NOT mutually exclusive.
export const SHORT_MIN = 5;
export const SHORT_MAX = 500;
export const ARTICLE_MIN = 200;
export const ARTICLE_MAX = 5000;

export const MAX_ANNOTATIONS = 200;
export const NOTE_TEXT_MAX = 500;
/** Optional background notes on Course (Phase 5 Category reuses this cap). */
export const DESCRIPTION_MAX = 1000;

// What the client sends per annotation. anchoredText is NOT accepted from the
// client: the server derives it from `content` at save time (see deriveAnchoredText)
// so the stored snapshot is always trustworthy. endIndex is INCLUSIVE, i.e. the
// annotated slice is content.slice(startIndex, endIndex + 1).
export const AnnotationInput = z.object({
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
  noteText: z.string().trim().min(1, 'note text is required').max(NOTE_TEXT_MAX),
});
export type AnnotationInput = z.infer<typeof AnnotationInput>;

export const AnnotationDTO = z.object({
  id: z.string(),
  startIndex: z.number().int(),
  endIndex: z.number().int(),
  noteText: z.string(),
  anchoredText: z.string(),
});
export type AnnotationDTO = z.infer<typeof AnnotationDTO>;

// Shared shape for create + edit. Both go through the same multi-step editor,
// so they accept the same payload; the route decides create vs atomic replace.
// NOTE: content length is intentionally NOT constrained here. Mode-length is a
// business rule (does this text fit the chosen mode?), not a payload-shape rule,
// so it lives in validateMode() and is rejected with 422 — the same class as
// annotation rules — instead of Zod's 400. Zod here only guards the *shape*.
const courseFields = {
  title: z.string().trim().min(1, 'title is required').max(200),
  content: z.string(),
  mode: CourseMode,
  categoryId: z.string().cuid().nullish(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullish(),
  annotations: z.array(AnnotationInput).max(MAX_ANNOTATIONS).default([]),
};

export const CreateCourseInput = z.object(courseFields);
// Request-payload type (z.input): annotations/categoryId are optional for callers
// because of .default()/.nullish(); .parse() still yields them fully populated.
export type CreateCourseInput = z.input<typeof CreateCourseInput>;

export const UpdateCourseInput = z.object(courseFields);
export type UpdateCourseInput = z.input<typeof UpdateCourseInput>;

export const CourseDTO = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  mode: CourseMode,
  categoryId: z.string().nullable(),
  description: z.string().nullable(),
  annotations: z.array(AnnotationDTO),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CourseDTO = z.infer<typeof CourseDTO>;

export const SEARCH_Q_MAX = 200;

export const CourseListSort = z.enum([
  'createdAt_desc',
  'createdAt_asc',
  'updatedAt_desc',
  'title_asc',
]);
export type CourseListSort = z.infer<typeof CourseListSort>;

export const ListCoursesQuery = z.object({
  mode: CourseMode.optional(),
  q: z.string().trim().max(SEARCH_Q_MAX).optional(),
  sort: CourseListSort.optional(),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuery>;

// --- Mode-length business rule ------------------------------------------------
// Same class as annotation rules: the payload shape is valid, but the content
// length violates the chosen mode's range. Server returns 422; the editor reuses
// it for pre-submit checks. Ranges overlap on purpose (see SHORT_*/ARTICLE_*).

export type ModeIssueCode =
  | 'short_too_short'
  | 'short_too_long'
  | 'article_too_short'
  | 'article_too_long';

export type ModeIssue = {
  code: ModeIssueCode;
  message: string;
};

// Returns null when the content length fits the chosen mode, otherwise a single
// structured issue. Each mode is checked only against its own [min, max]; the
// 200-500 overlap means a 350-char text passes as either SHORT or ARTICLE.
export function validateMode(content: string, mode: CourseMode): ModeIssue | null {
  const len = content.length;
  if (mode === 'SHORT') {
    if (len < SHORT_MIN) {
      return {
        code: 'short_too_short',
        message: `Short mode requires ${SHORT_MIN}-${SHORT_MAX} characters, got ${len}.`,
      };
    }
    if (len > SHORT_MAX) {
      return {
        code: 'short_too_long',
        message: `Short mode requires ${SHORT_MIN}-${SHORT_MAX} characters, got ${len}.`,
      };
    }
    return null;
  }
  if (len < ARTICLE_MIN) {
    return {
      code: 'article_too_short',
      message: `Article mode requires ${ARTICLE_MIN}-${ARTICLE_MAX} characters, got ${len}.`,
    };
  }
  if (len > ARTICLE_MAX) {
    return {
      code: 'article_too_long',
      message: `Article mode requires ${ARTICLE_MIN}-${ARTICLE_MAX} characters, got ${len}.`,
    };
  }
  return null;
}

// --- Content hygiene (line endings + control characters) ----------------------
// normalizeLineEndings runs before validateContentCharacters. Callers store
// LF-only content. validateContentCharacters assumes input is already normalized.

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export type ContentIssueCode = 'control_character';

export type ContentIssue = {
  code: ContentIssueCode;
  index: number;
  charCode: number;
};

/** Map an index in pre-normalization content to the normalized string. */
export function remapAnnotationIndexAfterLineEndingNormalization(
  oldContent: string,
  index: number,
): number {
  let newIndex = 0;
  let oldPos = 0;
  while (oldPos < index && oldPos < oldContent.length) {
    if (oldContent[oldPos] === '\r' && oldContent[oldPos + 1] === '\n') {
      oldPos += 2;
      newIndex += 1;
    } else if (oldContent[oldPos] === '\r') {
      oldPos += 1;
      newIndex += 1;
    } else {
      oldPos += 1;
      newIndex += 1;
    }
  }
  return newIndex;
}

export function validateContentCharacters(content: string): ContentIssue | null {
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (ch === '\n') continue;
    if (/\p{Cc}/u.test(ch)) {
      return {
        code: 'control_character',
        index: i,
        charCode: ch.codePointAt(0) ?? ch.charCodeAt(0),
      };
    }
  }
  return null;
}

export function formatContentIssueMessage(issue: ContentIssue): string {
  if (issue.charCode === 0x09) {
    return 'Text cannot contain tab characters. Please remove them and try again.';
  }
  return `Text contains an invisible character at position ${issue.index + 1}. Please remove it and try again.`;
}

export function prepareCourseContent(raw: string): {
  content: string;
  issue: ContentIssue | null;
} {
  const content = normalizeLineEndings(raw);
  return { content, issue: validateContentCharacters(content) };
}

// --- Annotation business rules (content-aware) --------------------------------
// Shape is validated by Zod; these rules depend on `content` and are shared by
// the server (returns 422) and, later, the editor for pre-submit checks.

export type AnnotationIssueCode =
  | 'order' // startIndex must be <= endIndex
  | 'bounds' // index outside [0, content.length)
  | 'anchor_start_whitespace' // start anchor char is whitespace
  | 'anchor_end_whitespace' // end anchor char is whitespace
  | 'ill_formed_range' // slice splits a surrogate pair / grapheme (e.g. partial emoji)
  | 'overlap'; // two annotations share characters

export type AnnotationIssue = {
  index: number; // position in the submitted annotations array
  code: AnnotationIssueCode;
  message: string;
};

// endIndex is inclusive: the anchored slice is content.slice(start, end + 1).
export function deriveAnchoredText(content: string, startIndex: number, endIndex: number): string {
  return content.slice(startIndex, endIndex + 1);
}

/** Detect lone UTF-16 surrogates (invalid for PostgreSQL text). */
function isWellFormedUtf16String(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) return false;
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** True when the inclusive range is safe to store (no split UTF-16 surrogates). */
export function isWellFormedAnnotationRange(
  content: string,
  startIndex: number,
  endIndex: number,
): boolean {
  if (startIndex > endIndex) return false;
  return isWellFormedUtf16String(deriveAnchoredText(content, startIndex, endIndex));
}

/**
 * Expand an inclusive range to grapheme-cluster boundaries so emoji/ZWJ sequences
 * are not split. Indices remain UTF-16 code-unit offsets (same as content.length).
 */
export function expandRangeToGraphemeBoundaries(
  content: string,
  startIndex: number,
  endIndex: number,
): { startIndex: number; endIndex: number } {
  let start = startIndex;
  let end = endIndex;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { index, segment } of segmenter.segment(content)) {
    const segEnd = index + segment.length - 1;
    if (startIndex > index && startIndex <= segEnd) {
      start = index;
    }
    if (endIndex >= index && endIndex < segEnd) {
      end = segEnd;
    }
  }
  return { startIndex: start, endIndex: end };
}

export function validateAnnotations(
  content: string,
  annotations: AnnotationInput[],
): AnnotationIssue[] {
  const issues: AnnotationIssue[] = [];
  const len = content.length;

  annotations.forEach((a, i) => {
    if (a.startIndex > a.endIndex) {
      issues.push({ index: i, code: 'order', message: 'startIndex must be <= endIndex' });
      return;
    }
    if (a.startIndex < 0 || a.endIndex >= len) {
      issues.push({
        index: i,
        code: 'bounds',
        message: `range [${a.startIndex}, ${a.endIndex}] is outside content [0, ${len - 1}]`,
      });
      return;
    }
    if (!isWellFormedAnnotationRange(content, a.startIndex, a.endIndex)) {
      issues.push({
        index: i,
        code: 'ill_formed_range',
        message: 'anchor range splits a multi-code-unit character (e.g. emoji)',
      });
      return;
    }
    if (/\s/.test(content.charAt(a.startIndex))) {
      issues.push({
        index: i,
        code: 'anchor_start_whitespace',
        message: 'start anchor cannot be a whitespace character',
      });
    }
    if (/\s/.test(content.charAt(a.endIndex))) {
      issues.push({
        index: i,
        code: 'anchor_end_whitespace',
        message: 'end anchor cannot be a whitespace character',
      });
    }
  });

  // Overlap: sort by start, then any interval whose start <= the max end seen so
  // far collides. endIndex is inclusive, so adjacent ranges (prevEnd + 1 == start)
  // do NOT overlap.
  const ordered = annotations
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.startIndex - y.a.startIndex || x.a.endIndex - y.a.endIndex);
  let maxEnd = -1;
  let maxOwner = -1;
  for (const { a, i } of ordered) {
    if (a.startIndex <= maxEnd) {
      issues.push({
        index: i,
        code: 'overlap',
        message: `annotation overlaps annotation #${maxOwner}`,
      });
    }
    if (a.endIndex > maxEnd) {
      maxEnd = a.endIndex;
      maxOwner = i;
    }
  }

  return issues;
}
