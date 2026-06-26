// Phase 6 session timer smoke (local only; NOT wired into CI).
//
// Prereqs: API on :3001 (seeded) and web dev server on :5173.
// Run: node apps/web/scripts/phase6-timer-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';
const COURSE_TITLE = 'Stray Birds - 49';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function findCourseId() {
  const res = await fetch(`${API}/api/courses`);
  if (!res.ok) throw new Error(`GET /api/courses -> ${res.status}`);
  const courses = await res.json();
  const c = courses.find((x) => x.title === COURSE_TITLE) ?? courses[0];
  if (!c) throw new Error('no courses found; did you seed?');
  return c;
}

async function armTimed(page, minutes) {
  await page.evaluate((m) => window.__phase6Timer?.armTimed(m), minutes);
}

async function main() {
  const course = await findCourseId();
  console.log(`Using course "${course.title}" (${course.id})`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const url = `${WEB}/courses/${course.id}/type`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('echotype-session-timer-hidden'));

  await page.waitForSelector('[data-testid="session-timer-set"]');
  await page.waitForSelector('[data-testid="typing-input"]');

  // T1: default idle — Set session timer button, no countdown
  assert(await page.getByRole('button', { name: 'Set session timer' }).isVisible(), 'idle timer button');

  // T2: invalid custom 8 min on Confirm — typing does not start session
  await page.getByTestId('session-timer-set').click();
  await page.getByPlaceholder('e.g. 25').fill('8');
  await page.getByTestId('session-timer-confirm').click();
  await page.waitForSelector('text=Duration must be between');
  await page.locator('[data-testid="typing-input"]').fill('x');
  await page.waitForTimeout(200);
  assert((await page.getByText(/left/).count()) === 0, 'invalid confirm does not start countdown');
  assert(await page.getByTestId('session-timer-confirm').isVisible(), 'still in config after invalid confirm');

  // T3: timed 10m — confirm + keystroke → countdown in strip
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="typing-input"]');
  await armTimed(page, 10);
  await page.locator('[data-testid="typing-input"]').fill('a');
  await page.waitForTimeout(300);
  assert(await page.getByText(/left/).isVisible(), 'countdown visible in strip');
  const remaining1 = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  assert(remaining1 != null && remaining1 <= 600 && remaining1 > 0, 'countdown running');

  // T4/T5: expire → modal → Don't save → T3-A
  await page.evaluate(() => window.__phase6Timer?.expireNow());
  await page.waitForSelector('text=Time\'s up');
  const timerDialog = page.getByRole('dialog', { name: "Time's up" });
  const saveInDialog = timerDialog.getByRole('button', { name: 'Save session' });
  assert(!(await saveInDialog.isDisabled()), 'save enabled when segment exists at expire');

  await timerDialog.getByRole('button', { name: "Don't save" }).click();
  await page.waitForTimeout(200);
  assert((await page.getByTestId('session-timer-set').count()) === 0, 'timer strip hidden after T3-A');
  assert(!(await page.locator('[data-testid="typing-input"]').isDisabled()), 'input enabled after dismiss');

  // T5b: Start over restores timer button after T3-A
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.waitForTimeout(200);
  assert(await page.getByTestId('session-timer-set').isVisible(), 'Start over restores timer button');

  // T6: new timed block → expire → Save
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="typing-input"]');
  await armTimed(page, 10);
  await page.locator('[data-testid="typing-input"]').fill('ab');
  await page.waitForTimeout(200);
  const sessionsBefore = await fetch(`${API}/api/courses/${course.id}`).then((r) => r.json()).then((c) => c.stats.sessionCount);
  await page.evaluate(() => window.__phase6Timer?.expireNow());
  await page.waitForSelector('text=Time\'s up');
  await page.getByRole('dialog', { name: "Time's up" }).getByRole('button', { name: 'Save session' }).click();
  await page.waitForTimeout(800);
  const sessionsAfter = await fetch(`${API}/api/courses/${course.id}`).then((r) => r.json()).then((c) => c.stats.sessionCount);
  assert(sessionsAfter > sessionsBefore, 'save on timer end persisted session');

  // T7: mid-timer save — countdown continues
  await page.reload({ waitUntil: 'networkidle' });
  await armTimed(page, 10);
  await page.locator('[data-testid="typing-input"]').fill('xy');
  await page.waitForTimeout(200);
  const beforeSave = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="typing-input"]').fill('z');
  const afterSave = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  assert(beforeSave != null && afterSave != null && afterSave < beforeSave, 'countdown continued after mid-save');

  // T8: timer end — Back blocked, no leave dialog
  await page.evaluate(() => window.__phase6Timer?.expireNow());
  await page.waitForSelector('text=Time\'s up');
  const pathBefore = page.url();
  await page.getByText('← Back').click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  assert(page.url() === pathBefore, 'back blocked during timer end modal');
  assert((await page.getByText('Leave typing page?').count()) === 0, 'no leave dialog during timer end');
  await page.getByRole('dialog', { name: "Time's up" }).getByRole('button', { name: "Don't save" }).click();

  await browser.close();
  console.log('==== Phase 6 timer probe PASS ====');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
