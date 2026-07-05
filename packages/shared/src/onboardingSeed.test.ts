import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideOnboardingSeed,
} from './onboardingSeed.js';

describe('decideOnboardingSeed', () => {
  it('returns already_resolved when onboardingSeededAt is set', () => {
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: '2026-01-01T00:00:00.000Z',
        catalogEmpty: false,
        courseCount: 0,
      }),
      'already_resolved',
    );
  });

  it('returns empty_catalog before courseCount check', () => {
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: null,
        catalogEmpty: true,
        courseCount: 5,
      }),
      'empty_catalog',
    );
  });

  it('returns waive when catalog has content and user has courses', () => {
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: null,
        catalogEmpty: false,
        courseCount: 2,
      }),
      'waive',
    );
  });

  it('returns materialize when catalog has content and courseCount is 0', () => {
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: null,
        catalogEmpty: false,
        courseCount: 0,
      }),
      'materialize',
    );
  });
});
