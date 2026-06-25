// Phase 5 stats-based list sort smoke (local only; NOT wired into CI).
//
// Prereq: API on :3001 with Phase 2 cumulative columns + indexes.
// Run: node apps/api/scripts/phase5-sort-probe.mjs

const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function idsInOrder(items, expectedIds, label) {
  const got = items.map((x) => x.id);
  assert(got.length === expectedIds.length, `${label}: length ${got.length} vs ${expectedIds.length}`);
  for (let i = 0; i < expectedIds.length; i++) {
    assert(got[i] === expectedIds[i], `${label}: index ${i} expected ${expectedIds[i]}, got ${got[i]}`);
  }
}

function subsetIdsInOrder(items, expectedIds, label) {
  const got = items.map((x) => x.id).filter((id) => expectedIds.includes(id));
  assert(got.length === expectedIds.length, `${label}: subset length`);
  for (let i = 0; i < expectedIds.length; i++) {
    assert(got[i] === expectedIds[i], `${label}: index ${i}`);
  }
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return json;
}

async function createCourse(label) {
  return api('POST', '/courses', {
    title: `Phase5 sort ${label} ${Date.now()}`,
    content: 'Probe course for stats-based sort assertions.',
    mode: 'SHORT',
    annotations: [],
  });
}

async function postSession(courseId, { durationSec, loopCount, startedAt, endedAt }) {
  await api('POST', '/sessions', {
    courseId,
    startedAt,
    endedAt,
    durationSec,
    charCount: 50,
    errorCount: 0,
    wpm: 40,
    accuracy: 1,
    loopCount,
    pasteRanges: [],
  });
}

async function main() {
  console.log(`API: ${API}`);
  await api('GET', '/health');

  const base = Date.now() + 400 * 24 * 60 * 60 * 1000;
  const t1 = new Date(base).toISOString();
  const t2 = new Date(base + 60_000).toISOString();
  const t3 = new Date(base + 120_000).toISOString();

  const courseA = await createCourse('A');
  const courseB = await createCourse('B');
  const courseC = await createCourse('C');
  const courseD = await createCourse('D');

  await postSession(courseA.id, { durationSec: 300, loopCount: 3, startedAt: t1, endedAt: t1 });
  await postSession(courseB.id, { durationSec: 60, loopCount: 10, startedAt: t3, endedAt: t3 });
  await postSession(courseC.id, { durationSec: 600, loopCount: 1, startedAt: t2, endedAt: t2 });
  // courseD: no sessions

  const probeIds = [courseA.id, courseB.id, courseC.id, courseD.id];

  let list = await api('GET', '/courses?mode=SHORT&categoryId=null&sort=loopCount_desc');
  subsetIdsInOrder(list, [courseB.id, courseA.id, courseC.id, courseD.id], 'loopCount_desc');

  list = await api('GET', '/courses?mode=SHORT&categoryId=null&sort=totalDuration_desc');
  subsetIdsInOrder(list, [courseC.id, courseA.id, courseB.id, courseD.id], 'totalDuration_desc');

  list = await api('GET', '/courses?mode=SHORT&categoryId=null&sort=lastPracticed_desc');
  subsetIdsInOrder(list, [courseB.id, courseC.id, courseA.id, courseD.id], 'lastPracticed_desc');

  list = await api(
    'GET',
    `/courses?mode=SHORT&categoryId=null&sort=loopCount_desc&q=${encodeURIComponent(courseB.title)}`,
  );
  assert(list.length === 1 && list[0].id === courseB.id, 'q + sort filters to B');

  const catHeavy = await api('POST', '/categories', {
    name: `Phase5 heavy ${Date.now()}`,
    mode: 'SHORT',
  });
  const catLight = await api('POST', '/categories', {
    name: `Phase5 light ${Date.now()}`,
    mode: 'SHORT',
  });
  const catEmpty = await api('POST', '/categories', {
    name: `Phase5 empty ${Date.now()}`,
    mode: 'SHORT',
  });

  await api('PATCH', '/courses/category', { courseIds: [courseB.id, courseC.id], categoryId: catHeavy.id });
  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId: catLight.id });

  const cats = await api('GET', '/categories?mode=SHORT&sort=loopCount_desc');
  const probeCatIds = [catHeavy.id, catLight.id, catEmpty.id];
  subsetIdsInOrder(
    cats.filter((c) => probeCatIds.includes(c.id)),
    [catHeavy.id, catLight.id, catEmpty.id],
    'categories loopCount_desc',
  );

  const catsByPractice = await api('GET', '/categories?mode=SHORT&sort=lastPracticed_desc');
  subsetIdsInOrder(
    catsByPractice.filter((c) => probeCatIds.includes(c.id)),
    [catHeavy.id, catLight.id, catEmpty.id],
    'categories lastPracticed_desc',
  );

  const inCollection = await api(
    'GET',
    `/courses?mode=SHORT&categoryId=${catHeavy.id}&sort=totalDuration_desc`,
  );
  idsInOrder(inCollection, [courseC.id, courseB.id], 'collection totalDuration_desc');

  await api('PATCH', '/courses/category', { courseIds: [courseB.id, courseC.id], categoryId: null });
  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId: null });
  await api('DELETE', `/categories/${catHeavy.id}`);
  await api('DELETE', `/categories/${catLight.id}`);
  await api('DELETE', `/categories/${catEmpty.id}`);
  for (const id of probeIds) {
    await api('DELETE', `/courses/${id}`);
  }

  console.log('==== Phase 5 sort probe PASS ====');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
