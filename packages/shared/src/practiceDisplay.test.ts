import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatLocalYmd,
  formatPracticeDuration,
  formatPracticeSummaryLine,
} from './practiceDisplay.js';

describe('formatPracticeDuration', () => {
  const cases: Array<[number, string]> = [
    [0, '1 min'],
    [30, '1 min'],
    [59, '1 min'],
    [60, '1 min'],
    [61, '2 min'],
    [3540, '59 min'],
    [3541, '1 hr'],
    [3600, '1 hr'],
    [3660, '1 hr 1 min'],
    [5400, '1 hr 30 min'],
    [5430, '1 hr 31 min'],
  ];

  for (const [sec, expected] of cases) {
    it(`${sec} sec → ${expected}`, () => {
      assert.equal(formatPracticeDuration(sec), expected);
    });
  }
});

describe('formatLocalYmd', () => {
  it('formats a local calendar date from ISO', () => {
    const iso = new Date(2026, 6, 20, 12, 0, 0).toISOString();
    assert.equal(formatLocalYmd(iso), '2026-07-20');
  });

  it('returns empty string for invalid ISO', () => {
    assert.equal(formatLocalYmd('not-a-date'), '');
  });
});

describe('formatPracticeSummaryLine', () => {
  const savedAt = new Date(2026, 6, 20, 12, 0, 0).toISOString();

  it('includes loops when totalCompletedPasses > 0', () => {
    assert.equal(
      formatPracticeSummaryLine({
        totalDurationSec: 5880,
        totalCompletedPasses: 47,
        lastSavedAt: new Date(2026, 4, 27, 12, 0, 0).toISOString(),
      }),
      '1 hr 38 min across 47 loops · Last saved 2026-05-27',
    );
  });

  it('uses singular loop for 1 pass', () => {
    assert.equal(
      formatPracticeSummaryLine({
        totalDurationSec: 60,
        totalCompletedPasses: 1,
        lastSavedAt: savedAt,
      }),
      '1 min across 1 loop · Last saved 2026-07-20',
    );
  });

  it('omits loops when totalCompletedPasses is 0', () => {
    assert.equal(
      formatPracticeSummaryLine({
        totalDurationSec: 2280,
        totalCompletedPasses: 0,
        lastSavedAt: savedAt,
      }),
      '38 min · Last saved 2026-07-20',
    );
  });

  it('shows minimum duration when totalCompletedPasses is 0 and duration is 0', () => {
    assert.equal(
      formatPracticeSummaryLine({
        totalDurationSec: 0,
        totalCompletedPasses: 0,
        lastSavedAt: savedAt,
      }),
      '1 min · Last saved 2026-07-20',
    );
  });
});
