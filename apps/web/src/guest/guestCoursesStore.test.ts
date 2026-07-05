import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  GUEST_SHORT_COLLECTION_ID,
  ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE,
} from '@echotype/shared';
import {
  GUEST_COURSES_STORAGE_KEY,
  _clearGuestStoreForTests,
  createGuestCourse,
  ensureGuestStoreSeeded,
  isGuestReadOnlyCourse,
  isGuestTempCourseId,
  listGuestCategories,
  listGuestCourses,
} from './guestCoursesStore.js';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  _clearGuestStoreForTests();
});

describe('guestCoursesStore', () => {
  it('seeds onboarding collections and courses from catalog', () => {
    ensureGuestStoreSeeded();
    const cats = listGuestCategories('SHORT');
    assert.ok(cats.some((c) => c.id === GUEST_SHORT_COLLECTION_ID));
    assert.ok(cats.some((c) => c.name === 'Beyond English'));
    const deer = listGuestCourses('SHORT').find(
      (c) => c.id === ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE,
    );
    assert.ok(deer);
    assert.equal(isGuestReadOnlyCourse(ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE), true);
  });

  it('creates guest temp courses with categoryId null', () => {
    ensureGuestStoreSeeded();
    const course = createGuestCourse({
      title: 'My draft',
      content: 'abcde',
      mode: 'SHORT',
    });
    assert.equal(course.categoryId, null);
    assert.equal(isGuestTempCourseId(course.id), true);
    assert.equal(isGuestReadOnlyCourse(course.id), false);
  });

  it('does not treat stable onboarding id shape as a guest temp course', () => {
    ensureGuestStoreSeeded();
    assert.equal(isGuestTempCourseId(ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE), false);
  });

  it('drops stale onboarding courses when catalog version bumps', () => {
    storage.set(
      GUEST_COURSES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        catalogVersion: 1,
        categories: [
          {
            id: '00000000-0000-4000-8001-000000000001',
            name: 'Samples',
            mode: 'SHORT',
            description: null,
            isReadOnly: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        courses: [
          {
            id: '00000000-0000-4000-8001-000000000102',
            title: 'Stray Birds - 49',
            content: 'thank you',
            mode: 'SHORT',
            categoryId: null,
            description: null,
            annotations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            isReadOnly: true,
            source: 'onboarding',
          },
        ],
      }),
    );

    ensureGuestStoreSeeded();
    assert.ok(listGuestCategories('SHORT').some((c) => c.name === 'Beyond English'));
    assert.equal(listGuestCourses('SHORT').length, 3);
  });

  it('replaces stale onboarding when catalogVersion matches but rows differ', () => {
    storage.set(
      GUEST_COURSES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        catalogVersion: 3,
        categories: [],
        courses: [
          {
            id: '00000000-0000-4000-8001-000000000102',
            title: 'Stray Birds - 49',
            content: 'thank you',
            mode: 'SHORT',
            categoryId: null,
            description: null,
            annotations: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            isReadOnly: true,
            source: 'onboarding',
          },
        ],
      }),
    );

    ensureGuestStoreSeeded();
    assert.equal(listGuestCourses('SHORT').length, 3);
  });
});
