import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NICKNAME_MAX, UpdateAccountInput } from '@echotype/shared';

describe('UpdateAccountInput', () => {
  it('accepts a trimmed nickname within max length', () => {
    const result = UpdateAccountInput.safeParse({ name: '  Echo  ' });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.name, 'Echo');
  });

  it('rejects empty nickname', () => {
    const result = UpdateAccountInput.safeParse({ name: '   ' });
    assert.equal(result.success, false);
  });

  it('rejects nickname over max length', () => {
    const result = UpdateAccountInput.safeParse({ name: 'a'.repeat(NICKNAME_MAX + 1) });
    assert.equal(result.success, false);
  });
});
