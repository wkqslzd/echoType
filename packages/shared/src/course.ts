import { z } from 'zod';

export const CourseMode = z.enum(['SHORT', 'ARTICLE']);
export type CourseMode = z.infer<typeof CourseMode>;

export const SHORT_MIN = 20;
export const SHORT_MAX = 500;
export const ARTICLE_MIN = 501;
export const ARTICLE_MAX = 5000;

export const MAX_ANNOTATIONS = 200;
export const NOTE_TEXT_MAX = 500;

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
const courseFields = {
  title: z.string().trim().min(1, 'title is required').max(200),
  content: z.string().min(SHORT_MIN).max(ARTICLE_MAX),
  mode: CourseMode,
  categoryId: z.string().cuid().nullish(),
  annotations: z.array(AnnotationInput).max(MAX_ANNOTATIONS).default([]),
};

const refineModeLength = (val: { mode: CourseMode; content: string }, ctx: z.RefinementCtx) => {
  const len = val.content.length;
  if (val.mode === 'SHORT' && (len < SHORT_MIN || len > SHORT_MAX)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: `SHORT mode requires ${SHORT_MIN}-${SHORT_MAX} characters, got ${len}.`,
    });
  }
  if (val.mode === 'ARTICLE' && (len < ARTICLE_MIN || len > ARTICLE_MAX)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: `ARTICLE mode requires ${ARTICLE_MIN}-${ARTICLE_MAX} characters, got ${len}.`,
    });
  }
};

export const CreateCourseInput = z.object(courseFields).superRefine(refineModeLength);
// Request-payload type (z.input): annotations/categoryId are optional for callers
// because of .default()/.nullish(); .parse() still yields them fully populated.
export type CreateCourseInput = z.input<typeof CreateCourseInput>;

export const UpdateCourseInput = z.object(courseFields).superRefine(refineModeLength);
export type UpdateCourseInput = z.input<typeof UpdateCourseInput>;

export const CourseDTO = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  mode: CourseMode,
  categoryId: z.string().nullable(),
  annotations: z.array(AnnotationDTO),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CourseDTO = z.infer<typeof CourseDTO>;

export const ListCoursesQuery = z.object({
  mode: CourseMode.optional(),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuery>;

// --- Annotation business rules (content-aware) --------------------------------
// Shape is validated by Zod; these rules depend on `content` and are shared by
// the server (returns 422) and, later, the editor for pre-submit checks.

export type AnnotationIssueCode =
  | 'order' // startIndex must be <= endIndex
  | 'bounds' // index outside [0, content.length)
  | 'anchor_start_whitespace' // start anchor char is whitespace
  | 'anchor_end_whitespace' // end anchor char is whitespace
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
