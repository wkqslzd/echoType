import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveNightMode } from './nightMode.ts';

describe('resolveNightMode', () => {
  it('follows browser prefers-color-scheme when preference is null', () => {
    assert.equal(resolveNightMode(null, true), true);
    assert.equal(resolveNightMode(null, false), false);
  });

  it('forces on when preference is 1', () => {
    assert.equal(resolveNightMode('1', false), true);
    assert.equal(resolveNightMode('1', true), true);
  });

  it('forces off when preference is 0', () => {
    assert.equal(resolveNightMode('0', true), false);
    assert.equal(resolveNightMode('0', false), false);
  });
});
