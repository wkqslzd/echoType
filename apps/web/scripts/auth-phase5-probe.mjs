// Auth Phase 5 smoke (local only; NOT wired into CI).
//
// Prereq: web :5173; API :3001 for Part D; apps/web/.env VITE_COGNITO_* for optional Part B/D.
// Part A: forgot/reset + account guest guard (no Cognito account).
// Part B (optional): PROBE_COGNITO_AUTH=1 + TEST_USER_EMAIL — forgotPassword() only.
// Part D (optional): PROBE_COGNITO_AUTH=1 + TEST_USER_EMAIL/PASSWORD — account nickname.
//
// Run:
//   node apps/web/scripts/auth-phase5-probe.mjs
//   PROBE_COGNITO_AUTH=1 TEST_USER_EMAIL=... TEST_USER_PASSWORD=... node apps/web/scripts/auth-phase5-probe.mjs

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
  console.log('Part C PASS');
}

async function runPartA(page) {
  console.log('--- Part A: forgot/reset password routes ---');

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await page.goto(`${WEB}/forgot-password`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/forgot-password/, { timeout: 10_000 });
  await page.getByRole('heading', { name: 'Reset password' }).waitFor();

  await page.goto(`${WEB}/reset-password?email=probe%40example.com`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/\/reset-password/, { timeout: 10_000 });
  await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();

  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Forgot password?' }).waitFor();

  await page.goto(`${WEB}/account`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  assert(page.url().includes('next='), 'guest /account should redirect to login with next=');

  console.log('Part A PASS');
}

async function runPartD(page) {
  console.log('--- Part D: account page (authed) ---');
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  assert(email && password, 'TEST_USER_EMAIL and TEST_USER_PASSWORD required for Part D');

  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/courses\/short/, { timeout: 20_000 });

  await page.getByTestId('auth-display-name').click();
  await page.waitForURL(/\/account/, { timeout: 10_000 });
  await page.getByRole('heading', { name: 'Account' }).waitFor();

  const suffix = Date.now().toString().slice(-6);
  const newNickname = `Probe${suffix}`;
  await page.fill('input[autocomplete="nickname"]', newNickname);
  await page.getByRole('button', { name: 'Save nickname' }).click();
  await page.getByText('Nickname updated.').waitFor({ timeout: 15_000 });
  await page.getByTestId('auth-display-name').waitFor({ timeout: 10_000 });
  const headerName = await page.getByTestId('auth-display-name').textContent();
  assert(headerName?.includes(newNickname), 'header display name should update after nickname save');

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('echotype.auth.session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.accessToken ?? null;
  });
  assert(token, 'expected stored access token after login');

  const accountRes = await fetch(`${API}/api/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(accountRes.ok, `GET /api/account failed: ${accountRes.status}`);
  const account = await accountRes.json();
  if (account.name !== newNickname) {
    throw new Error(`ASSERT: API account name expected ${newNickname}, got ${account.name}`);
  }

  console.log('Part D PASS');
}

async function runPartB(page) {
  console.log('--- Part B: forgotPassword via UI ---');
  const email = process.env.TEST_USER_EMAIL;
  assert(email, 'TEST_USER_EMAIL required for Part B');

  await page.goto(`${WEB}/forgot-password`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/reset-password/, { timeout: 15_000 });
  assert(page.url().includes('email='), 'reset page should include email param');
  console.log('Part B PASS (code delivery not verified — check email manually)');
}

async function main() {
  console.log(`WEB: ${WEB}`);
  runUnitTests();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await runPartA(page);

    if (process.env.PROBE_COGNITO_AUTH === '1') {
      await runPartB(page);
      await runPartD(page);
      console.log('SUMMARY PASS (Part C + A + B + D)');
    } else {
      console.log('SUMMARY PASS (Part C + A); set PROBE_COGNITO_AUTH=1 for Part B + D');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
