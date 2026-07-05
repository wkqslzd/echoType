import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OnboardingCatalog } from './onboardingCatalog.js';
import {
  GUEST_ARTICLE_COLLECTION_ID,
  GUEST_SHORT_COLLECTION_ID,
  isOnboardingCatalogEmpty,
  materializeOnboardingGuestRecords,
  ONBOARDING_CATALOG,
  validateOnboardingCatalog,
} from './onboardingCatalog.js';

const SHORT_CONTENT_A = 'abcde';
const SHORT_CONTENT_B = 'vwxyz';
const SHORT_CONTENT_C = '12345';
const SHORT_CONTENT_D = '67890';
const ARTICLE_CONTENT_A = 'a'.repeat(200);
const ARTICLE_CONTENT_B = 'b'.repeat(200);
const ARTICLE_CONTENT_C = 'c'.repeat(200);
const ARTICLE_CONTENT_D = 'd'.repeat(200);

function sampleCatalog(): OnboardingCatalog {
  return {
    version: 99,
    collections: [
      {
        stableId: GUEST_SHORT_COLLECTION_ID,
        mode: 'SHORT',
        name: 'Short Samples',
        description: 'Short collection intro',
      },
      {
        stableId: GUEST_ARTICLE_COLLECTION_ID,
        mode: 'ARTICLE',
        name: 'Article Samples',
        description: 'Article collection intro',
      },
    ],
    courses: [
      {
        stableId: '00000000-0000-4000-8001-000000000101',
        mode: 'SHORT',
        collectionStableId: GUEST_SHORT_COLLECTION_ID,
        title: 'Short In Collection',
        content: SHORT_CONTENT_A,
        annotations: [{ phrase: 'abc', note: 'note' }],
      },
      {
        stableId: '00000000-0000-4000-8001-000000000111',
        mode: 'SHORT',
        collectionStableId: null,
        title: 'Short Standalone 1',
        content: SHORT_CONTENT_B,
        annotations: [],
      },
      {
        stableId: '00000000-0000-4000-8001-000000000112',
        mode: 'SHORT',
        collectionStableId: null,
        title: 'Short Standalone 2',
        content: SHORT_CONTENT_C,
        annotations: [],
      },
      {
        stableId: '00000000-0000-4000-8001-000000000201',
        mode: 'ARTICLE',
        collectionStableId: GUEST_ARTICLE_COLLECTION_ID,
        title: 'Article In Collection',
        content: ARTICLE_CONTENT_A,
        annotations: [],
      },
      {
        stableId: '00000000-0000-4000-8001-000000000211',
        mode: 'ARTICLE',
        collectionStableId: null,
        title: 'Article Standalone 1',
        content: ARTICLE_CONTENT_B,
        annotations: [],
      },
      {
        stableId: '00000000-0000-4000-8001-000000000212',
        mode: 'ARTICLE',
        collectionStableId: null,
        title: 'Article Standalone 2',
        content: ARTICLE_CONTENT_C,
        annotations: [],
      },
    ],
  };
}

describe('isOnboardingCatalogEmpty', () => {
  it('treats an explicit empty catalog as empty', () => {
    assert.equal(
      isOnboardingCatalogEmpty({ version: 0, collections: [], courses: [] }),
      true,
    );
  });

  it('treats the shipped onboarding catalog as non-empty', () => {
    assert.equal(isOnboardingCatalogEmpty(ONBOARDING_CATALOG), false);
  });
});

describe('validateOnboardingCatalog', () => {
  it('accepts an empty catalog', () => {
    assert.deepEqual(
      validateOnboardingCatalog({ version: 0, collections: [], courses: [] }),
      [],
    );
  });

  it('accepts the shipped onboarding catalog', () => {
    assert.deepEqual(validateOnboardingCatalog(ONBOARDING_CATALOG), []);
  });

  it('accepts a full sample catalog', () => {
    assert.deepEqual(validateOnboardingCatalog(sampleCatalog()), []);
  });

  it('rejects wrong standalone counts', () => {
    const catalog = sampleCatalog();
    catalog.courses = catalog.courses.filter((c) => c.mode !== 'SHORT' || c.collectionStableId !== null);
    const issues = validateOnboardingCatalog(catalog);
    assert.ok(issues.some((i) => i.code === 'standalone_count' && i.mode === 'SHORT'));
  });
});

describe('materializeOnboardingGuestRecords', () => {
  it('materializes collection descriptions from catalog', () => {
    const { categories, courses } = materializeOnboardingGuestRecords(sampleCatalog());
    assert.equal(categories.length, 2);
    const shortCol = categories.find((c) => c.id === GUEST_SHORT_COLLECTION_ID);
    assert.equal(shortCol?.description, 'Short collection intro');
    const inCollection = courses.find((c) => c.id === '00000000-0000-4000-8001-000000000101');
    assert.equal(inCollection?.categoryId, GUEST_SHORT_COLLECTION_ID);
  });

  it('returns no onboarding rows for an explicit empty catalog', () => {
    const { categories, courses } = materializeOnboardingGuestRecords({
      version: 0,
      collections: [],
      courses: [],
    });
    assert.equal(categories.length, 0);
    assert.equal(courses.length, 0);
  });

  it('materializes the shipped onboarding catalog', () => {
    const { categories, courses } = materializeOnboardingGuestRecords(ONBOARDING_CATALOG);
    assert.equal(categories.length, 2);
    assert.equal(courses.length, 6);
  });
});
