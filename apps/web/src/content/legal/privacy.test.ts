import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRIVACY_POLICY } from './privacy.js';

describe('PRIVACY_POLICY', () => {
  it('uses the approved contact email', () => {
    assert.equal(PRIVACY_POLICY.contactEmail, 'dennygan.nz@gmail.com');
  });

  it('includes required disclosure sections', () => {
    const headings = PRIVACY_POLICY.sections.map((section) => section.heading);
    assert.ok(headings.includes('What we collect'));
    assert.ok(headings.includes('Account deletion'));
    assert.ok(headings.includes('Data storage'));
  });

  it('documents guest browser-only practice data', () => {
    const practice = PRIVACY_POLICY.sections
      .find((section) => section.heading === 'What we collect')
      ?.blocks.find((block) => block.type === 'labeled' && block.label === 'Practice data:');
    assert.ok(practice && practice.type === 'labeled');
    assert.match(practice.text, /browser/i);
  });

  it('discloses Google sign-in data use', () => {
    const google = PRIVACY_POLICY.sections
      .find((section) => section.heading === 'What we collect')
      ?.blocks.find((block) => block.type === 'labeled' && block.label === 'Google sign-in:');
    assert.ok(google && google.type === 'labeled');
    assert.match(google.text, /Google OAuth/i);
    assert.match(google.text, /do not receive your Google password/i);
  });
});
