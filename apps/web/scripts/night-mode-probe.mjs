// Typing-session Night mode + DocumentDark coexistence (local only; NOT wired into CI).
//
// Night override is C1-memory: in-tab module state only (SPA nav keeps it; reload clears).
//
// Prereqs: web dev server on :5173 (guest onboarding courses are local).
// Run: node apps/web/scripts/night-mode-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
/** Onboarding catalog stable id for Stray Birds — 49 (Tagore). */
const COURSE_ID = process.env.COURSE_ID ?? '00000000-0000-4000-8001-000000000111';
const NIGHT_KEY = 'echotype-night-mode';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function gotoTyping(page) {
  await page.goto(`${WEB}/courses/${COURSE_ID}/type`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="typing-input"]');
  await page.waitForSelector('[data-testid="night-mode"]');
}

async function htmlHasDark(page) {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

async function nightChecked(page) {
  return page.getByTestId('night-mode').getAttribute('aria-checked');
}

async function localNightKey(page) {
  return page.evaluate((key) => localStorage.getItem(key), NIGHT_KEY);
}

async function main() {
  console.log(`Using guest course ${COURSE_ID}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

  // N1: start light; clear any legacy localStorage pin
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, NIGHT_KEY);
  await gotoTyping(page);
  assert(!(await htmlHasDark(page)), 'N1: html should not have dark');
  assert((await nightChecked(page)) === 'false', 'N1: night switch off under light system');
  assert(
    (await page.locator('[data-testid="typing-session-shell"]').count()) === 1,
    'N1: typing-session-shell present',
  );

  // N2: follow system dark (no override)
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert(await htmlHasDark(page), 'N2: html dark when system dark');
  assert((await nightChecked(page)) === 'true', 'N2: night switch on under dark system');

  // N3: force off while system dark — memory only (no localStorage write)
  await page.getByTestId('night-mode').click();
  assert((await nightChecked(page)) === 'false', 'N3: switch off after click');
  assert(!(await htmlHasDark(page)), 'N3: html dark removed after force off');
  assert((await localNightKey(page)) === null, 'N3: localStorage not used for override');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(80);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(80);
  assert(!(await htmlHasDark(page)), 'N3: still off after system flips while override 0');
  assert(await page.getByTestId('night-mode-use-system').isVisible(), 'N3: use-system visible');

  // N4: clear to system → follow again
  await page.getByTestId('night-mode-use-system').click();
  assert((await localNightKey(page)) === null, 'N4: localStorage still empty');
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert((await nightChecked(page)) === 'true', 'N4: follows dark system again');
  assert(
    (await page.getByTestId('night-mode-use-system').count()) === 0,
    'N4: use-system hidden without override',
  );

  // N5: force on under light system
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  await page.getByTestId('night-mode').click();
  assert((await nightChecked(page)) === 'true', 'N5: forced on');
  assert(await htmlHasDark(page), 'N5: html dark when forced on');
  assert((await localNightKey(page)) === null, 'N5: override not written to localStorage');

  // N6: timer-end dialog under night (portal + html.dark)
  await page.locator('[data-testid="typing-input"]').fill('ab');
  await page.evaluate(() => window.__phase6Timer?.armTimed(10));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__phase6Timer?.expireNow());
  await page.waitForSelector('[role="dialog"]');
  assert(await htmlHasDark(page), 'N6: html still dark while timer-end dialog open');
  await page.getByRole('button', { name: "Don't save" }).click();
  await page.waitForSelector('[data-testid="typing-input"]');
  assert(await htmlHasDark(page), 'N6b: night remains after dismissing timer dialog');

  // N7: SPA leave (click Short) — list follows light; memory override kept for SPA return
  await page.getByRole('link', { name: 'Short' }).click();
  await page.waitForURL('**/courses/short');
  assert(!(await htmlHasDark(page)), 'N7: list follows light system (override ignored off typing)');
  assert((await localNightKey(page)) === null, 'N7: localStorage empty');
  assert(
    (await page.locator('[data-testid="typing-session-shell"]').count()) === 0,
    'N7: typing-session-shell absent off typing route',
  );
  const typeLink = page.locator(`a[href="/courses/${COURSE_ID}/type"]`).first();
  assert((await typeLink.count()) > 0, 'N7: guest list exposes type link for SPA return');
  await typeLink.click();
  await page.waitForSelector('[data-testid="night-mode"]');
  assert(await htmlHasDark(page), 'N7b: SPA return keeps memory override 1 under light system');
  assert((await nightChecked(page)) === 'true', 'N7b: switch still on');

  // N8: reload clears memory override — follow browser again
  await page.emulateMedia({ colorScheme: 'dark' });
  await gotoTyping(page);
  // ensure override 0 via UI
  if ((await nightChecked(page)) === 'true') {
    await page.getByTestId('night-mode').click();
  }
  assert((await nightChecked(page)) === 'false', 'N8: forced off before reload');
  assert(!(await htmlHasDark(page)), 'N8: typing light before reload');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="night-mode"]');
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert(await htmlHasDark(page), 'N8: after reload follows system dark');
  assert((await nightChecked(page)) === 'true', 'N8: switch follows system after reload');
  assert((await localNightKey(page)) === null, 'N8: localStorage empty after reload');

  // N9: legacy localStorage pin is cleared on boot and not loaded into memory
  await page.evaluate((key) => localStorage.setItem(key, '0'), NIGHT_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="night-mode"]');
  assert((await localNightKey(page)) === null, 'N9: legacy localStorage key removed');
  assert(await htmlHasDark(page), 'N9: follows system dark (legacy 0 not applied)');
  assert((await nightChecked(page)) === 'true', 'N9: switch on — not stuck light from legacy 0');

  console.log('night-mode-probe: OK');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
