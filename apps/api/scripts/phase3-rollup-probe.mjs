// Phase 3 collection rollup smoke probe (local only; NOT wired into CI).
//
// Exercises GET/POST /categories rollup via live API:
//   1. Empty collection → rollup zeros
//   2. Assign member courses → rollup matches sum of course.stats
//   3. POST /sessions on a member → rollup increments
//   4. Remove member from collection → rollup decreases
//
// Prereq: API on :3001 with Phase 2 migration applied (seeded courses OK).
//   Run:  node apps/api/scripts/phase3-rollup-probe.mjs

const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function rollupEq(a, b, label) {
  assert(a.totalDurationSec === b.totalDurationSec, `${label} totalDurationSec`);
  assert(a.totalCompletedPasses === b.totalCompletedPasses, `${label} totalCompletedPasses`);
  assert(a.lastPracticedAt === b.lastPracticedAt, `${label} lastPracticedAt`);
}

function sumRollupFromCourses(courses) {
  let totalDurationSec = 0;
  let totalCompletedPasses = 0;
  let lastPracticedAt = null;
  for (const c of courses) {
    const s = c.stats;
    totalDurationSec += s.totalDurationSec;
    totalCompletedPasses += s.totalCompletedPasses;
    if (s.lastPracticedAt != null) {
      if (lastPracticedAt === null || s.lastPracticedAt > lastPracticedAt) {
        lastPracticedAt = s.lastPracticedAt;
      }
    }
  }
  return { totalDurationSec, totalCompletedPasses, lastPracticedAt };
}

async function api(method, path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return json;
}

async function main() {
  console.log(`API: ${API}`);
  const health = await api('GET', '/health');
  console.log('health', health);

  const probeName = `Phase3 rollup probe ${Date.now()}`;
  const created = await api('POST', '/categories', { name: probeName, mode: 'SHORT' });
  const categoryId = created.id;
  console.log(`created collection ${categoryId}`);

  rollupEq(
    created.rollup,
    { totalDurationSec: 0, totalCompletedPasses: 0, lastPracticedAt: null },
    'new collection',
  );

  let cat = await api('GET', `/categories/${categoryId}`);
  rollupEq(
    cat.rollup,
    { totalDurationSec: 0, totalCompletedPasses: 0, lastPracticedAt: null },
    'GET empty',
  );

  const uncategorized = await api('GET', '/courses?mode=SHORT&categoryId=null');
  assert(uncategorized.length >= 1, 'need at least one uncategorized SHORT course');
  const courseA = uncategorized[0];
  const courseB = uncategorized.length >= 2 ? uncategorized[1] : null;

  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId });
  if (courseB) {
    await api('PATCH', '/courses/category', { courseIds: [courseB.id], categoryId });
  }

  const courseAFresh = await api('GET', `/courses/${courseA.id}`);
  const members = [courseAFresh];
  if (courseB) {
    members.push(await api('GET', `/courses/${courseB.id}`));
  }

  cat = await api('GET', `/categories/${categoryId}`);
  rollupEq(cat.rollup, sumRollupFromCourses(members), 'after assign (no new sessions)');

  const sessionPayload = {
    courseId: courseA.id,
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    endedAt: new Date().toISOString(),
    durationSec: 120,
    charCount: 100,
    errorCount: 5,
    wpm: 50,
    accuracy: 0.95,
    loopCount: 2,
    pasteRanges: [],
  };
  const saved = await api('POST', '/sessions', sessionPayload);
  assert(saved.courseStats != null, 'POST /sessions returns courseStats');
  assert(saved.session.loopCount === 2, 'session loopCount');

  const courseAAfter = await api('GET', `/courses/${courseA.id}`);
  members[0] = courseAAfter;
  cat = await api('GET', `/categories/${categoryId}`);
  rollupEq(cat.rollup, sumRollupFromCourses(members), 'after session on course A');

  const list = await api('GET', '/categories?mode=SHORT');
  const fromList = list.find((c) => c.id === categoryId);
  assert(fromList != null, 'collection in list');
  rollupEq(fromList.rollup, cat.rollup, 'list vs detail');

  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId: null });
  members.shift();
  cat = await api('GET', `/categories/${categoryId}`);
  rollupEq(cat.rollup, sumRollupFromCourses(members), 'after remove course A');

  await api('DELETE', `/categories/${categoryId}`);
  console.log('cleaned up probe collection');

  console.log('\n==== Phase 3 rollup probe PASS ====');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
