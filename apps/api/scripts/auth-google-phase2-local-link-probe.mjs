// Local-only: exercise POST /api/auth/federated/link then GET /api/account
// using real Cognito tokens from a localhost Google OAuth callback.
//
// 1. Start API: pnpm --filter @echotype/api dev
// 2. Complete Google sign-in at http://localhost:5173/login (Continue with Google)
// 3. In DevTools → Application → localStorage → echotype.auth.session (after callback)
//    OR Network → federated/link request → copy Authorization + idToken body
// 4. Export:
//      export TEST_ACCESS_TOKEN='eyJ...'
//      export TEST_ID_TOKEN='eyJ...'
// 5. Run:
//      pnpm --filter @echotype/api probe:auth-google-phase2-local-link
//
// Optional: API_BASE=http://localhost:3001

const API_BASE = (process.env.API_BASE ?? 'http://localhost:3001').replace(/\/$/, '');
const accessToken = process.env.TEST_ACCESS_TOKEN?.trim();
const idToken = process.env.TEST_ID_TOKEN?.trim();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  if (!accessToken || !idToken) {
    fail('Set TEST_ACCESS_TOKEN and TEST_ID_TOKEN (from localhost OAuth callback).');
  }

  console.log(`API: ${API_BASE}`);

  const linkRes = await fetch(`${API_BASE}/api/auth/federated/link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });
  const linkBody = await linkRes.json().catch(() => null);
  console.log('link status:', linkRes.status, linkBody);
  if (!linkRes.ok) {
    fail(`link returned ${linkRes.status}`);
  }

  const accountRes = await fetch(`${API_BASE}/api/account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const accountBody = await accountRes.json().catch(() => null);
  console.log('account status:', accountRes.status, accountBody);
  if (accountRes.status !== 200) {
    fail(`account returned ${accountRes.status} (new_user provisioning or auth hook)`);
  }

  if (!accountBody?.email || !accountBody?.id) {
    fail('account response missing id/email');
  }

  console.log(`PASS: account ${accountBody.email} (${accountBody.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
