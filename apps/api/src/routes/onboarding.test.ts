import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideOnboardingSeed } from '@echotype/shared';

describe('onboarding seed route decision', () => {
  it('matches the documented step order', () => {
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: new Date(),
        catalogEmpty: true,
        courseCount: 0,
      }),
      'already_resolved',
    );
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: null,
        catalogEmpty: true,
        courseCount: 3,
      }),
      'empty_catalog',
    );
    assert.equal(
      decideOnboardingSeed({
        onboardingSeededAt: null,
        catalogEmpty: false,
        courseCount: 1,
      }),
      'waive',
    );
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
