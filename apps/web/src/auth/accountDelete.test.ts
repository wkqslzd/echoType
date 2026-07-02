import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DELETE_CONFIRMATION_TEXT, isDeleteConfirmationValid } from '@echotype/shared';

describe('isDeleteConfirmationValid', () => {
  it('accepts exact DELETE', () => {
    assert.equal(isDeleteConfirmationValid(DELETE_CONFIRMATION_TEXT), true);
    assert.equal(isDeleteConfirmationValid('  DELETE  '), true);
  });

  it('rejects wrong casing or text', () => {
    assert.equal(isDeleteConfirmationValid('delete'), false);
    assert.equal(isDeleteConfirmationValid(''), false);
  });
});
