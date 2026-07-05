// Auth Phase 6 smoke (local only; NOT wired into CI).
//
// Prereq: web :5173; API :3001; migration applied (onboardingSeededAt).
// Part C: unit tests (shared catalog + api onboarding decision).
// Part A: guest browse with empty onboarding catalog.
// Part B (optional): PROBE_COGNITO_AUTH=1 + TEST_USER_EMAIL/PASSWORD in apps/web/.env.
//
// Run:
//   node apps/web/scripts/auth-phase6-probe.mjs
//   PROBE_COGNITO_AUTH=1 node apps/web/scripts/auth-phase6-probe.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

function loadDotEnv(relativeToScript, segments) {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ...segments);
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadDotEnv(import.meta.url, ['..', '.env']);
loadDotEnv(import.meta.url, ['..', '..', 'api', '.env']);

if (!process.env.VITE_COGNITO_USER_POOL_ID && process.env.COGNITO_USER_POOL_ID) {
  process.env.VITE_COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
}
if (!process.env.VITE_COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_ID) {
  process.env.VITE_COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
}

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function runUnitTests() {
  console.log('--- Part C: unit tests ---');
  execFileSync('pnpm', ['--filter', '@echotype/web', 'test:auth'], {
    stdio: 'inherit',
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  });
  execFileSync('pnpm', ['--filter', '@echotype/api', 'test:auth'], {
    stdio: 'inherit',
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  });
  console.log('Part C PASS');
}

async function runPartA(page) {
  console.log('--- Part A: guest browse (onboarding catalog) ---');

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await page.goto(`${WEB}/courses/short`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/courses\/short/, { timeout: 10_000 });

  await page.getByText('Beyond English').waitFor({ timeout: 10_000 });
  await page.getByText('Deer Enclosure').waitFor({ timeout: 10_000 });
  await page.getByText('Stray Birds').waitFor({ timeout: 10_000 });

  console.log('Part A PASS');
}

async function login(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/courses\/short/, { timeout: 20_000 });
}

async function runPartB(page) {
  console.log('--- Part B: authed onboarding seed hook ---');
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.log(
      'Part B SKIP (set TEST_USER_EMAIL and TEST_USER_PASSWORD in apps/web/.env — re-register after Phase 5 delete)',
    );
    return false;
  }

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await login(page, email, password);

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('echotype.auth.session');
    if (!raw) return null;
    return JSON.parse(raw).accessToken ?? null;
  });
  assert(token, 'expected access token after login');

  const accountBefore = await fetch(`${API}/api/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(accountBefore.ok, `GET /api/account failed: ${accountBefore.status}`);
  const accountBody = await accountBefore.json();
  if (accountBody.onboardingSeededAt !== null) {
    console.log('Part B SKIP (user already has onboardingSeededAt — use fresh test user)');
    return false;
  }

  const coursesBefore = await fetch(`${API}/api/courses?mode=SHORT`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(coursesBefore.ok, `GET /api/courses failed: ${coursesBefore.status}`);
  const courseListBefore = await coursesBefore.json();
  const hadCourses = courseListBefore.length > 0;

  const seedRes = await fetch(`${API}/api/onboarding/seed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(seedRes.status === 204, `POST /api/onboarding/seed expected 204, got ${seedRes.status}`);

  const accountAfter = await fetch(`${API}/api/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterBody = await accountAfter.json();
  assert(
    afterBody.onboardingSeededAt !== null,
    'seed hook should resolve onboardingSeededAt (materialize or waive)',
  );

  if (!hadCourses) {
    const coursesAfter = await fetch(`${API}/api/courses?mode=SHORT`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const courseListAfter = await coursesAfter.json();
    assert(
      courseListAfter.some((c) => c.title?.includes('Deer Enclosure')),
      'fresh user should receive onboarding courses after seed',
    );
  }

  console.log('Part B PASS');
  return true;
}

async function main() {
  console.log(`WEB: ${WEB}`);
  runUnitTests();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await runPartA(page);

    if (process.env.PROBE_COGNITO_AUTH === '1') {
      const ranB = await runPartB(page);
      console.log(ranB ? 'SUMMARY PASS (Part C + A + B)' : 'SUMMARY PASS (Part C + A); Part B skipped');
    } else {
      console.log('SUMMARY PASS (Part C + A); set PROBE_COGNITO_AUTH=1 for Part B');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
