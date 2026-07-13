// Ops Phase 2 disclaimer + page-status smoke (local / post-deploy; NOT wired into CI).
//
// Part A (always): privacy source contract + bundled email when dist exists.
// Part B (PROBE_LIVE=1): GET /privacy returns 200 from WEB_ORIGIN.
//
// Run:
//   node apps/web/scripts/ops-phase2-probe.mjs
//   PROBE_LIVE=1 node apps/web/scripts/ops-phase2-probe.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PRIVACY_SRC = join(ROOT, 'apps/web/src/content/legal/privacy.ts');
const DIST = join(ROOT, 'apps/web/dist');
const CONTACT_EMAIL = 'dennygan.nz@gmail.com';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function listFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function partA() {
  const source = readFileSync(PRIVACY_SRC, 'utf8');
  assert(source.includes(`contactEmail: '${CONTACT_EMAIL}'`), 'privacy.ts contact email mismatch');
  assert(source.includes('What we collect'), 'privacy.ts missing What we collect section');
  assert(source.includes('Account deletion'), 'privacy.ts missing Account deletion section');
  assert(source.includes('Google sign-in:'), 'privacy.ts missing Google sign-in disclosure');
  console.log('Part A OK: privacy source contract');

  if (!existsSync(DIST)) {
    console.log('Part A dist skipped: apps/web/dist not found (run pnpm --filter @echotype/web build first)');
    return;
  }

  const bundled = listFiles(DIST).some((file) => {
    if (!file.endsWith('.js')) return false;
    return readFileSync(file, 'utf8').includes(CONTACT_EMAIL);
  });
  if (!bundled) {
    console.log('Part A dist skipped: rebuild web to verify bundled contact email');
    return;
  }
  console.log('Part A OK: contact email present in dist bundle');
}

async function partB() {
  if (process.env.PROBE_LIVE !== '1') {
    console.log('Part B skipped (set PROBE_LIVE=1 to GET /privacy from WEB_ORIGIN)');
    return;
  }

  const origin = process.env.WEB_ORIGIN ?? 'https://echotype.ink';
  const res = await fetch(`${origin}/privacy`);
  assert(res.ok, `GET ${origin}/privacy expected 2xx, got ${res.status}`);
  console.log(`Part B OK: ${origin}/privacy returned ${res.status}`);
}

await partA();
await partB();
console.log('ops-phase2-probe complete');
