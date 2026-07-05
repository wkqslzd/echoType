import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE } from '@echotype/shared';
import { resolvePostLoginPath } from './resolvePostLoginPath.js';
import {
  _clearGuestStoreForTests,
  createGuestCourse,
  ensureGuestStoreSeeded,
} from '../guest/guestCoursesStore.js';

const storage = new Map<string, string>();

describe('resolvePostLoginPath', () => {
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
    ensureGuestStoreSeeded();
  });

  it('keeps non-typing next paths unchanged', () => {
    assert.equal(resolvePostLoginPath('/courses/short'), '/courses/short');
    assert.equal(resolvePostLoginPath('/courses/article'), '/courses/article');
  });

  it('keeps onboarding typing next paths unchanged', () => {
    const next = `/courses/${ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE}/type`;
    assert.equal(resolvePostLoginPath(next), next);
  });

  it('redirects guest temp course typing next to fallback', () => {
    const guest = createGuestCourse({
      title: 'Temp',
      content: 'hello',
      mode: 'SHORT',
    });
    const next = `/courses/${guest.id}/type`;
    assert.equal(resolvePostLoginPath(next), '/courses/short');
  });

  it('redirects unknown uuid typing next when not in guest store', () => {
    const next = '/courses/00000000-0000-4000-8001-999999999999/type';
    assert.equal(resolvePostLoginPath(next), next);
  });
});
