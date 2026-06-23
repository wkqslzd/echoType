import { PrismaClient, CourseMode } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo-user';

const STRAY_BIRDS_49 = `I thank thee that I am none of the wheels of power but I am one with the living creatures that are crushed by it.`;

const WHAT_I_HAVE_LIVED_FOR = `Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like great winds, have blown me hither and thither, in a wayward course, over a deep ocean of anguish, reaching to the very verge of despair. I have sought love, first, because it brings ecstasy - ecstasy so great that I would often have sacrificed all the rest of life for a few hours of this joy. I have sought it, next, because it relieves loneliness - that terrible loneliness in which one shivering consciousness looks over the rim of the world into the cold unfathomable lifeless abyss. I have sought it, finally, because in the union of love I have seen, in a mystic miniature, the prefiguring vision of the heaven that saints and poets have imagined. This is what I sought, and though it might seem too good for human life, this is what - at last - I have found.`;

const GETTYSBURG_OPENING = `Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.

Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.`;

// Build annotation rows by locating each phrase in the content. endIndex is
// inclusive (anchoredText === content.slice(start, end + 1)); the anchor chars
// must be non-whitespace, which holds for all phrases below.
function buildAnnotations(
  content: string,
  specs: { phrase: string; note: string }[],
): { startIndex: number; endIndex: number; noteText: string; anchoredText: string }[] {
  return specs.map(({ phrase, note }) => {
    const startIndex = content.indexOf(phrase);
    if (startIndex < 0) throw new Error(`seed: phrase not found in content: "${phrase}"`);
    const endIndex = startIndex + phrase.length - 1;
    return {
      startIndex,
      endIndex,
      noteText: note,
      anchoredText: content.slice(startIndex, endIndex + 1),
    };
  });
}

const STRAY_BIRDS_49_ANNOTATIONS = buildAnnotations(STRAY_BIRDS_49, [
  { phrase: 'thank', note: '感谢；致谢' },
  { phrase: 'wheels', note: '轮子（喻指权力运转的机器）' },
  { phrase: 'the living creatures', note: '有生命的造物；活生生的众生' },
]);

// Phase 4.2 manual QA: edit flow with a small, obvious annotation set (≥3).
const PHASE42_THREE_NOTES = `The maiden in the meadow thanked the wheels of fortune for the gentle rain upon every living creature in the meadow below the amber sky at dusk.`;

const PHASE42_THREE_NOTES_ANNOTATIONS = buildAnnotations(PHASE42_THREE_NOTES, [
  { phrase: 'maiden', note: '少女；妇人' },
  { phrase: 'wheels', note: '轮子（喻指命运或权力的齿轮）' },
  { phrase: 'living creature', note: '有生命的造物' },
]);

// Phase 4.2 manual QA: prepend one character in Step 1 to turn all notes yellow (10+).
const PHASE42_TWELVE_NOTES = `When silence falls upon the meadow, the heron stands still by the reeds. A distant bell rings twice across the water. Morning light touches every leaf and every stone along the path we walked yesterday.`;

const PHASE42_TWELVE_NOTES_ANNOTATIONS = buildAnnotations(PHASE42_TWELVE_NOTES, [
  { phrase: 'silence', note: '寂静' },
  { phrase: 'meadow', note: '草地' },
  { phrase: 'heron', note: '苍鹭' },
  { phrase: 'reeds', note: '芦苇' },
  { phrase: 'distant', note: '遥远的' },
  { phrase: 'bell', note: '钟声' },
  { phrase: 'water', note: '水面' },
  { phrase: 'Morning', note: '清晨' },
  { phrase: 'leaf', note: '叶子' },
  { phrase: 'stone', note: '石头' },
  { phrase: 'path', note: '小径' },
  { phrase: 'yesterday', note: '昨天' },
]);

// Sample course for IME (Phase 3) + newline-skip (ADR-0007) manual QA: a short
// multi-line Chinese passage. Wang Wei's poem echoes EchoType's theme ("但闻人语
// 响" = echo; "复照" = repetition). noteText is English gloss for English-native
// readers exploring the Chinese text.
const DEER_ENCLOSURE = `空山不见人，但闻人语响。
返景入深林，复照青苔上。`;

const DEER_ENCLOSURE_ANNOTATIONS = buildAnnotations(DEER_ENCLOSURE, [
  { phrase: '空山', note: 'On the lonely mountain' },
  { phrase: '不见人', note: 'I see no one' },
  { phrase: '但闻人语响', note: 'Yet I hear the echo of voices' },
  { phrase: '返景', note: 'the returning sun rays' },
  { phrase: '入深林', note: 'Into the deep, deep forest' },
  { phrase: '复照青苔上', note: 'Shining once more upon luscious, green moss' },
]);

const DEER_ENCLOSURE_DESCRIPTION =
  'Deer Enclosure (Lu Zhai) is a celebrated Tang dynasty poem by Wang Wei, and one of the most beloved works in the Chinese literary canon. The poem moves through stillness, echo, and returning light: "Yet I hear the echo of voices" evokes echo, while "Shining once more upon luscious green moss" suggests return, repetition, and quiet settling. This course lets you type Wang Wei\'s lines, and the poem mirrors EchoType itself: quiet, repeated, echoing, and reflective, in sync with what the product is named for.';

async function upsertAnnotatedCourse(
  userId: string,
  categoryId: string,
  title: string,
  content: string,
  mode: CourseMode,
  annotations: ReturnType<typeof buildAnnotations>,
  description?: string | null,
) {
  let course = await prisma.course.findFirst({ where: { userId, title } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        userId,
        categoryId,
        title,
        content,
        mode,
        description: description ?? null,
        annotations: { create: annotations },
      },
    });
    return course;
  }
  await prisma.$transaction([
    prisma.course.update({
      where: { id: course.id },
      data: { content, mode, categoryId, description: description ?? null },
    }),
    prisma.annotation.deleteMany({ where: { courseId: course.id } }),
    prisma.annotation.createMany({
      data: annotations.map((a) => ({ ...a, courseId: course.id })),
    }),
  ]);
  return course;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: 'demo@echotype.local',
      name: 'Demo User',
    },
  });

  const strayBirdsCategory = await prisma.category.upsert({
    where: {
      userId_mode_name: { userId: user.id, mode: CourseMode.SHORT, name: 'Stray Birds' },
    },
    update: {},
    create: { userId: user.id, mode: CourseMode.SHORT, name: 'Stray Birds' },
  });

  const essaysCategory = await prisma.category.upsert({
    where: {
      userId_mode_name: { userId: user.id, mode: CourseMode.ARTICLE, name: 'Classic Essays' },
    },
    update: {},
    create: { userId: user.id, mode: CourseMode.ARTICLE, name: 'Classic Essays' },
  });

  const samplesCategory = await prisma.category.upsert({
    where: {
      userId_mode_name: { userId: user.id, mode: CourseMode.SHORT, name: 'Samples' },
    },
    update: {},
    create: { userId: user.id, mode: CourseMode.SHORT, name: 'Samples' },
  });

  let shortCourse = await prisma.course.findFirst({
    where: { userId: user.id, title: 'Stray Birds - 49' },
  });
  if (!shortCourse) {
    shortCourse = await prisma.course.create({
      data: {
        userId: user.id,
        categoryId: strayBirdsCategory.id,
        title: 'Stray Birds - 49',
        content: STRAY_BIRDS_49,
        mode: CourseMode.SHORT,
        annotations: { create: STRAY_BIRDS_49_ANNOTATIONS },
      },
    });
  } else {
    // Refresh the demo annotations idempotently so re-seeding always yields the
    // same overlay used by the Phase 2 read-only AnnotatedText demo.
    await prisma.$transaction([
      prisma.annotation.deleteMany({ where: { courseId: shortCourse.id } }),
      prisma.annotation.createMany({
        data: STRAY_BIRDS_49_ANNOTATIONS.map((a) => ({ ...a, courseId: shortCourse!.id })),
      }),
    ]);
  }

  await upsertAnnotatedCourse(
    user.id,
    strayBirdsCategory.id,
    'Phase 4.2 — Three Notes (SHORT)',
    PHASE42_THREE_NOTES,
    CourseMode.SHORT,
    PHASE42_THREE_NOTES_ANNOTATIONS,
  );

  await upsertAnnotatedCourse(
    user.id,
    strayBirdsCategory.id,
    'Phase 4.2 — Twelve Notes (SHORT)',
    PHASE42_TWELVE_NOTES,
    CourseMode.SHORT,
    PHASE42_TWELVE_NOTES_ANNOTATIONS,
  );

  const existingArticle = await prisma.course.findFirst({
    where: { userId: user.id, title: 'What I Have Lived For (excerpt)' },
  });
  if (!existingArticle) {
    await prisma.course.create({
      data: {
        userId: user.id,
        categoryId: essaysCategory.id,
        title: 'What I Have Lived For (excerpt)',
        content: WHAT_I_HAVE_LIVED_FOR,
        mode: CourseMode.ARTICLE,
      },
    });
  }

  await upsertAnnotatedCourse(
    user.id,
    essaysCategory.id,
    'Gettysburg Address (opening)',
    GETTYSBURG_OPENING,
    CourseMode.ARTICLE,
    [],
  );

  await upsertAnnotatedCourse(
    user.id,
    samplesCategory.id,
    'Deer Enclosure 鹿柴 (Wang Wei)',
    DEER_ENCLOSURE,
    CourseMode.SHORT,
    DEER_ENCLOSURE_ANNOTATIONS,
    DEER_ENCLOSURE_DESCRIPTION,
  );

  console.log(`Seed complete. Demo user: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
