import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  clearLegacyNightModeLocalStorage,
  readNightModePreference,
  resetNightModePreferenceForTests,
  resolveDocumentDark,
  resolveNightMode,
  subscribeNightModePreference,
  writeNightModePreference,
  NIGHT_MODE_STORAGE_KEY,
} from './nightMode.ts';

beforeEach(() => {
  resetNightModePreferenceForTests();
});

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

describe('resolveDocumentDark', () => {
  it('U1: non-typing follows browser dark', () => {
    assert.equal(resolveDocumentDark(false, null, true), true);
  });

  it('U2: non-typing ignores override 0 (still follows browser)', () => {
    assert.equal(resolveDocumentDark(false, '0', true), true);
  });

  it('U3: non-typing ignores override 1 when browser is light', () => {
    assert.equal(resolveDocumentDark(false, '1', false), false);
  });

  it('U4–U5: typing with null follows browser', () => {
    assert.equal(resolveDocumentDark(true, null, true), true);
    assert.equal(resolveDocumentDark(true, null, false), false);
  });

  it('U6: typing override 0 forces light under browser dark', () => {
    assert.equal(resolveDocumentDark(true, '0', true), false);
  });

  it('U7: typing override 1 forces dark under browser light', () => {
    assert.equal(resolveDocumentDark(true, '1', false), true);
  });
});

describe('in-memory night preference (C1-memory)', () => {
  it('notifies listeners on write', () => {
    const seen: Array<'1' | '0' | null> = [];
    const unsub = subscribeNightModePreference((p) => {
      seen.push(p);
    });
    writeNightModePreference('0');
    writeNightModePreference(null);
    writeNightModePreference('1');
    unsub();
    writeNightModePreference(null);
    assert.deepEqual(seen, ['0', null, '1']);
  });

  it('read returns memory value; does not persist to localStorage', () => {
    writeNightModePreference('1');
    assert.equal(readNightModePreference(), '1');
    if (typeof localStorage !== 'undefined') {
      assert.equal(localStorage.getItem(NIGHT_MODE_STORAGE_KEY), null);
    }
  });

  it('clearLegacyNightModeLocalStorage removes old pin without loading it', () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(NIGHT_MODE_STORAGE_KEY, '1');
    clearLegacyNightModeLocalStorage();
    assert.equal(localStorage.getItem(NIGHT_MODE_STORAGE_KEY), null);
    assert.equal(readNightModePreference(), null);
  });
});
