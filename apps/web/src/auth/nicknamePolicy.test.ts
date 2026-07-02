import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NICKNAME_MAX } from '@echotype/shared';
import { validateNickname } from './nicknamePolicy.js';

describe('validateNickname', () => {
  it('accepts a non-empty nickname', () => {
    assert.equal(validateNickname('Echo'), null);
  });

  it('rejects empty nickname', () => {
    assert.match(validateNickname('   ') ?? '', /required/i);
  });

  it('rejects nickname over max length', () => {
    assert.match(validateNickname('a'.repeat(NICKNAME_MAX + 1)) ?? '', /at most/);
  });
});
