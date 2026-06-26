// Phase 6 sessionTimer helpers smoke (local only; NOT wired into CI).
// Run: cd apps/web && pnpm exec tsx scripts/phase6-session-timer-unit.mjs

import {
  formatCountdown,
  parseTimerMinutesInput,
  resolveTimedDurationMinutes,
} from '../src/lib/sessionTimer.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

assert(formatCountdown(125) === '2:05', 'formatCountdown');
assert(parseTimerMinutesInput('25').ok === true, 'valid custom');
assert(parseTimerMinutesInput('２５').ok === true, 'fullwidth digits normalize');
assert(parseTimerMinutesInput('8').ok === false, 'below min');
assert(parseTimerMinutesInput('121').ok === false, 'above max');
assert(parseTimerMinutesInput('abc').ok === false, 'non-numeric');
const mixed = parseTimerMinutesInput('２a');
assert(mixed.ok === false && mixed.message.includes('standard digits'), 'mixed invalid shows digit hint');

assert(resolveTimedDurationMinutes(30, '').ok === true, 'preset fallback');
const custom = resolveTimedDurationMinutes(30, '45');
assert(custom.ok === true && custom.minutes === 45, 'custom overrides');

console.log('==== Phase 6 sessionTimer unit PASS ====');
