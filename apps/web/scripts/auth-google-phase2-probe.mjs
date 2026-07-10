// Google sign-in Phase 2 smoke (local only; NOT wired into CI).
//
// Part A: shared + API federated link unit tests.
// Part B: Playwright — /login Google button + /auth/callback error surface.
// Part C (PROBE_COGNITO_AUTH=1): email/password regression subset from auth-phase4-probe.
//
// Run:
//   pnpm --filter @echotype/web probe:auth-google-phase2
//   PROBE_COGNITO_AUTH=1 TEST_USER_EMAIL=... TEST_USER_PASSWORD=... pnpm --filter @echotype/web probe:auth-google-phase2

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';

function runPartA() {
  console.log('--- Part A: unit tests ---');
  execFileSync('pnpm', ['--filter', '@echotype/api', 'test:auth-google-phase2'], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  console.log('Part A PASS');
}

async function runPartB(page) {
  console.log('--- Part B: login button + callback error UI ---');
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-google').waitFor({ timeout: 10_000 });

  await page.goto(`${WEB}/auth/callback`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Sign-in expired or invalid').waitFor({ timeout: 10_000 });
  console.log('Part B PASS');
}

async function runPartC() {
  console.log('--- Part C: email/password regression (auth-phase4 Part B) ---');
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('PROBE_COGNITO_AUTH requires TEST_USER_EMAIL/PASSWORD');
  }
  execFileSync(
    'node',
    ['scripts/auth-phase4-probe.mjs'],
    {
      stdio: 'inherit',
      cwd: join(ROOT, 'apps/web'),
      env: { ...process.env, PROBE_COGNITO_AUTH: '1', TEST_USER_EMAIL: email, TEST_USER_PASSWORD: password },
    },
  );
  console.log('Part C PASS');
}

async function main() {
  console.log(`WEB: ${WEB}`);
  runPartA();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await runPartB(page);
  } finally {
    await browser.close();
  }

  if (process.env.PROBE_COGNITO_AUTH === '1') {
    await runPartC();
    console.log('SUMMARY PASS (A + B + C)');
  } else {
    console.log('SUMMARY PASS (A + B); set PROBE_COGNITO_AUTH=1 for Part C');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
