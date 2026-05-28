import { z } from 'zod';

export const CourseMode = z.enum(['SHORT', 'ARTICLE']);
export type CourseMode = z.infer<typeof CourseMode>;

export const SHORT_MIN = 20;
export const SHORT_MAX = 500;
export const ARTICLE_MIN = 501;
export const ARTICLE_MAX = 5000;

export const CreateCourseInput = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200),
    content: z.string().min(SHORT_MIN).max(ARTICLE_MAX),
    mode: CourseMode,
    categoryId: z.string().cuid().nullish(),
  })
  .superRefine((val, ctx) => {
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
  });
export type CreateCourseInput = z.infer<typeof CreateCourseInput>;

export const CourseDTO = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  mode: CourseMode,
  categoryId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CourseDTO = z.infer<typeof CourseDTO>;

export const ListCoursesQuery = z.object({
  mode: CourseMode.optional(),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuery>;
