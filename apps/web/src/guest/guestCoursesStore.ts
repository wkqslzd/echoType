import type {
  AnnotationDTO,
  CourseDTO,
  CourseListSort,
  CourseMode,
  CategoryDTO,
  CreateCourseInput,
  UpdateCourseInput,
} from '@echotype/shared';
import {
  deriveAnchoredText,
  guestCategoryToDTO,
  guestCourseToDTO,
  materializeOnboardingGuestRecords,
  ONBOARDING_CATALOG_VERSION,
  type GuestCategoryRecord,
  type GuestCourseRecord,
} from '@echotype/shared';

export const GUEST_COURSES_STORAGE_KEY = 'echotype-guest-courses';

export type GuestCoursesStorageV1 = {
  version: 1;
  catalogVersion: number;
  categories: GuestCategoryRecord[];
  courses: GuestCourseRecord[];
};

function nowIso() {
  return new Date().toISOString();
}

function newAnnotationId() {
  return crypto.randomUUID();
}

function readStorage(): GuestCoursesStorageV1 | null {
  try {
    const raw = localStorage.getItem(GUEST_COURSES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestCoursesStorageV1;
    if (parsed?.version !== 1 || !Array.isArray(parsed.courses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(storage: GuestCoursesStorageV1) {
  localStorage.setItem(GUEST_COURSES_STORAGE_KEY, JSON.stringify(storage));
}

function reconcileWithCatalog(storage: GuestCoursesStorageV1 | null): GuestCoursesStorageV1 {
  const seed = materializeOnboardingGuestRecords();
  const guestCourses = storage?.courses.filter((c) => c.source === 'guest') ?? [];
  return {
    version: 1,
    catalogVersion: ONBOARDING_CATALOG_VERSION,
    categories: seed.categories,
    courses: [...seed.courses, ...guestCourses],
  };
}

function onboardingMatchesCatalog(storage: GuestCoursesStorageV1): boolean {
  const seed = materializeOnboardingGuestRecords();
  const storedOnboarding = storage.courses.filter((c) => c.source === 'onboarding');
  if (storage.catalogVersion !== ONBOARDING_CATALOG_VERSION) return false;
  if (storage.categories.length !== seed.categories.length) return false;
  if (storedOnboarding.length !== seed.courses.length) return false;
  const seedIds = new Set(seed.courses.map((c) => c.id));
  return storedOnboarding.every((c) => seedIds.has(c.id));
}

export function ensureGuestStoreSeeded(): GuestCoursesStorageV1 {
  const storage = readStorage();
  if (!storage || !onboardingMatchesCatalog(storage)) {
    const reconciled = reconcileWithCatalog(storage);
    writeStorage(reconciled);
    return reconciled;
  }
  return storage;
}

function loadStorage(): GuestCoursesStorageV1 {
  return ensureGuestStoreSeeded();
}

function categoryNameFor(storage: GuestCoursesStorageV1, categoryId: string | null) {
  if (!categoryId) return null;
  return storage.categories.find((c) => c.id === categoryId)?.name ?? null;
}

function sortCourses(courses: CourseDTO[], sort: CourseListSort): CourseDTO[] {
  const copy = [...courses];
  switch (sort) {
    case 'createdAt_asc':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'updatedAt_desc':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'title_asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'loopCount_desc':
    case 'totalDuration_desc':
    case 'lastPracticed_desc':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'createdAt_desc':
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function matchesQuery(text: string, q: string) {
  return text.toLowerCase().includes(q.toLowerCase());
}

export function isGuestReadOnlyCourse(courseId: string): boolean {
  const storage = readStorage();
  const course = storage?.courses.find((c) => c.id === courseId);
  return course?.isReadOnly === true;
}

export function isGuestTempCourseId(courseId: string): boolean {
  const storage = readStorage();
  if (!storage) return false;
  const course = storage.courses.find((c) => c.id === courseId);
  return course?.source === 'guest';
}

export function listGuestCourses(
  mode: CourseMode,
  opts?: { q?: string; sort?: CourseListSort; categoryId?: string | 'null' },
): CourseDTO[] {
  const storage = loadStorage();
  let records = storage.courses.filter((c) => c.mode === mode);
  if (opts?.categoryId === 'null') {
    records = records.filter((c) => c.categoryId == null);
  } else if (opts?.categoryId) {
    records = records.filter((c) => c.categoryId === opts.categoryId);
  }
  let dtos = records.map((r) => guestCourseToDTO(r, categoryNameFor(storage, r.categoryId)));
  if (opts?.q) {
    const q = opts.q;
    dtos = dtos.filter(
      (c) =>
        matchesQuery(c.title, q) ||
        matchesQuery(c.content, q) ||
        (c.description && matchesQuery(c.description, q)) ||
        c.annotations.some((a) => matchesQuery(a.noteText, q)),
    );
  }
  return sortCourses(dtos, opts?.sort ?? 'createdAt_desc');
}

export function listGuestCategories(
  mode: CourseMode,
  opts?: { q?: string; sort?: CourseListSort },
): CategoryDTO[] {
  const storage = loadStorage();
  let cats = storage.categories.filter((c) => c.mode === mode);
  if (opts?.q) {
    const q = opts.q;
    cats = cats.filter(
      (c) =>
        matchesQuery(c.name, q) || (c.description != null && matchesQuery(c.description, q)),
    );
  }
  const dtos = cats.map((cat) => {
    const count = storage.courses.filter(
      (c) => c.mode === mode && c.categoryId === cat.id,
    ).length;
    return guestCategoryToDTO(cat, count);
  });
  if (opts?.sort === 'title_asc') {
    return [...dtos].sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...dtos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getGuestCourse(id: string): CourseDTO | null {
  const storage = loadStorage();
  const record = storage.courses.find((c) => c.id === id);
  if (!record) return null;
  return guestCourseToDTO(record, categoryNameFor(storage, record.categoryId));
}

export function getGuestCategory(id: string): CategoryDTO | null {
  const storage = loadStorage();
  const record = storage.categories.find((c) => c.id === id);
  if (!record) return null;
  const count = storage.courses.filter((c) => c.categoryId === id).length;
  return guestCategoryToDTO(record, count);
}

function buildAnnotationDtos(
  content: string,
  annotations: CreateCourseInput['annotations'],
): AnnotationDTO[] {
  const list = annotations ?? [];
  return list.map((a) => ({
    id: newAnnotationId(),
    startIndex: a.startIndex,
    endIndex: a.endIndex,
    noteText: a.noteText,
    anchoredText: deriveAnchoredText(content, a.startIndex, a.endIndex),
  }));
}

export function createGuestCourse(input: CreateCourseInput): CourseDTO {
  const storage = loadStorage();
  const ts = nowIso();
  const record: GuestCourseRecord = {
    id: crypto.randomUUID(),
    title: input.title,
    content: input.content,
    mode: input.mode,
    categoryId: null,
    description: input.description ?? null,
    annotations: buildAnnotationDtos(input.content, input.annotations),
    createdAt: ts,
    updatedAt: ts,
    isReadOnly: false,
    source: 'guest',
  };
  storage.courses.push(record);
  writeStorage(storage);
  return guestCourseToDTO(record, null);
}

export function updateGuestCourse(id: string, input: UpdateCourseInput): CourseDTO {
  const storage = loadStorage();
  const idx = storage.courses.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('not_found');
  const existing = storage.courses[idx]!;
  if (existing.isReadOnly) throw new Error('read_only');
  const updated: GuestCourseRecord = {
    ...existing,
    title: input.title,
    content: input.content,
    mode: input.mode,
    categoryId: null,
    description: input.description ?? null,
    annotations: buildAnnotationDtos(input.content, input.annotations),
    updatedAt: nowIso(),
  };
  storage.courses[idx] = updated;
  writeStorage(storage);
  return guestCourseToDTO(updated, null);
}

export function deleteGuestCourse(id: string): void {
  const storage = loadStorage();
  const course = storage.courses.find((c) => c.id === id);
  if (!course) throw new Error('not_found');
  if (course.isReadOnly) throw new Error('read_only');
  storage.courses = storage.courses.filter((c) => c.id !== id);
  writeStorage(storage);
}

export function checkGuestTitleAvailable(
  mode: CourseMode,
  title: string,
  excludeId?: string,
): boolean {
  const storage = loadStorage();
  const normalized = title.trim().toLowerCase();
  return !storage.courses.some(
    (c) =>
      c.mode === mode &&
      c.id !== excludeId &&
      c.title.trim().toLowerCase() === normalized,
  );
}

/** For tests — reset localStorage guest data. */
export function _clearGuestStoreForTests(): void {
  localStorage.removeItem(GUEST_COURSES_STORAGE_KEY);
}
