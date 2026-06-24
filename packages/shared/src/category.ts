import { z } from 'zod';
import { CourseMode, CourseListSort, DESCRIPTION_MAX, SEARCH_Q_MAX } from './course.js';
import { CategoryRollupDTO } from './categoryRollup.js';

export const CATEGORY_NAME_MAX = 200;
export const PATCH_COURSES_CATEGORY_MAX = 100;

export const CreateCategoryInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(CATEGORY_NAME_MAX),
  mode: CourseMode,
  description: z.string().trim().max(DESCRIPTION_MAX).nullish(),
});
export type CreateCategoryInput = z.input<typeof CreateCategoryInput>;

export const UpdateCategoryInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(CATEGORY_NAME_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullish(),
});
export type UpdateCategoryInput = z.input<typeof UpdateCategoryInput>;

export const CategoryDTO = z.object({
  id: z.string(),
  name: z.string(),
  mode: CourseMode,
  description: z.string().nullable(),
  courseCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rollup: CategoryRollupDTO,
});
export type CategoryDTO = z.infer<typeof CategoryDTO>;

export const ListCategoriesQuery = z.object({
  mode: CourseMode.optional(),
  q: z.string().trim().max(SEARCH_Q_MAX).optional(),
  sort: CourseListSort.optional(),
});
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuery>;

export const PatchCoursesCategoryInput = z.object({
  courseIds: z.array(z.string().cuid()).min(1).max(PATCH_COURSES_CATEGORY_MAX),
  categoryId: z.string().cuid().nullable(),
});
export type PatchCoursesCategoryInput = z.infer<typeof PatchCoursesCategoryInput>;
