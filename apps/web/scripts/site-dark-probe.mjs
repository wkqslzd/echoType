// Site-wide DocumentDark (local only; NOT wired into CI).
//
// Prereqs: web dev server on :5173.
// Run: node apps/web/scripts/site-dark-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const NIGHT_KEY = 'echotype-night-mode';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function htmlHasDark(page) {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

  // Clear override once at start (not addInitScript — re-runs on every navigation).
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, NIGHT_KEY);

  // S1: system light → home no dark
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
  assert(!(await htmlHasDark(page)), 'S1: home no html.dark under light');
  assert((await page.locator('[data-testid="app-shell"]').count()) === 1, 'S1: app-shell');

  // S2: system dark → home dark
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert(await htmlHasDark(page), 'S2: home html.dark under dark');

  // S3: Auth login under system dark
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  assert(await htmlHasDark(page), 'S3: /login html.dark under system dark');

  // S4: flip to light on home
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  assert(!(await htmlHasDark(page)), 'S4: home loses dark when system goes light');

  console.log('site-dark-probe: OK');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
