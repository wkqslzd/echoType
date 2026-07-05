import type { AnnotationDTO, CourseMode } from './course.js';
import { ARTICLE_MAX, ARTICLE_MIN, deriveAnchoredText, SHORT_MAX, SHORT_MIN } from './course.js';
import { categoryRollupFromMembers } from './categoryRollup.js';
import type { CategoryDTO } from './category.js';
import type { CourseDTO } from './course.js';
import { courseStatsFromRow } from './courseStats.js';

export type CatalogAnnotationSpec = {
  phrase: string;
  note: string;
};

export type CatalogCollectionDef = {
  stableId: string;
  mode: CourseMode;
  name: string;
  description: string | null;
};

/** User-agnostic onboarding course; materialized into guest store or API seed. */
export type CatalogCourseDef = {
  stableId: string;
  mode: CourseMode;
  /** null = standalone on the mode list (no collection). */
  collectionStableId: string | null;
  title: string;
  content: string;
  description?: string | null;
  annotations: CatalogAnnotationSpec[];
};

export type OnboardingCatalog = {
  version: number;
  collections: CatalogCollectionDef[];
  courses: CatalogCourseDef[];
};

/** Guest onboarding stable IDs (namespace 8001). */
export const GUEST_SHORT_COLLECTION_ID = '00000000-0000-4000-8001-000000000001';
export const GUEST_ARTICLE_COLLECTION_ID = '00000000-0000-4000-8001-000000000002';

/** Deer Enclosure — onboarding SHORT collection course; also used in routing tests. */
export const ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE = '00000000-0000-4000-8001-000000000101';

/** Phase 6.2 onboarding catalog — owner content (2026). */
export const ONBOARDING_CATALOG: OnboardingCatalog = {
  version: 3,
  collections: [
    {
      stableId: GUEST_SHORT_COLLECTION_ID,
      mode: 'SHORT',
      name: 'Beyond English',
      description:
        'EchoType works with any script. This collection features a Tang dynasty poem in Classical Chinese — type the characters, follow the English translations, and experience how the app extends beyond the Latin alphabet.',
    },
    {
      stableId: GUEST_ARTICLE_COLLECTION_ID,
      mode: 'ARTICLE',
      name: 'Great Speeches',
      description:
        'Words spoken at moments that mattered. This collection features landmark speeches — language shaped under pressure, for an audience, with history listening. Type the sentences, feel their rhythm, and read the annotations that unpack what makes them endure.',
    },
  ],
  courses: [
    {
      stableId: ONBOARDING_GUEST_STABLE_COURSE_ID_EXAMPLE,
      mode: 'SHORT',
      collectionStableId: GUEST_SHORT_COLLECTION_ID,
      title: 'Deer Enclosure 鹿柴 (Wang Wei)',
      description:
        'This course exists to show that EchoType is not limited to any one language or script. Deer Enclosure (Lu Zhai) is a celebrated Tang dynasty poem by Wang Wei, and one of the most beloved works in the Chinese literary canon. The poem moves through stillness, echo, and returning light: "Yet I hear the echo of voices" evokes echo, while "Shining once more upon luscious green moss" suggests return, repetition, and quiet settling. This course lets you type Wang Wei\'s lines, and the poem mirrors EchoType itself: quiet, repeated, echoing, and reflective, in sync with what the product is named for.',
      content: `空山不见人，但闻人语响。
返景入深林，复照青苔上。`,
      annotations: [
        { phrase: '空山', note: 'On the lonely mountain' },
        { phrase: '不见人', note: 'I see no one' },
        { phrase: '但闻人语响', note: 'Yet I hear the echo of voices' },
        { phrase: '返景', note: 'the returning sun rays' },
        { phrase: '入深林', note: 'Into the deep, deep forest' },
        { phrase: '复照青苔上', note: 'Shining once more upon luscious, green moss' },
      ],
    },
    {
      stableId: '00000000-0000-4000-8001-000000000111',
      mode: 'SHORT',
      collectionStableId: null,
      title: 'Stray Birds — 49 (Tagore)',
      description:
        'English prose with Chinese annotations — the primary use case EchoType was built for. Chinese-speaking learners of English type authentic literary text and read notes in their native language. Tagore\'s Stray Birds offers short, complete thoughts ideal for this practice.',
      content: `I thank thee that I am none of the wheels of power but I am one with the living creatures that are crushed by it.`,
      annotations: [
        { phrase: 'thank thee', note: '感谢上帝（thee 为古英语"你"）' },
        { phrase: 'wheels of power', note: '权力机器的齿轮' },
        { phrase: 'living creatures', note: '有生命的众生' },
        { phrase: 'crushed by it', note: '被它碾压、摧毁' },
      ],
    },
    {
      stableId: '00000000-0000-4000-8001-000000000112',
      mode: 'SHORT',
      collectionStableId: null,
      title: 'Sonnet 18 (Shakespeare)',
      description:
        'Shakespeare\'s English is Early Modern — written around 1600, it uses grammar and vocabulary that native English speakers today find genuinely unfamiliar. This course annotates the archaic words and constructions, making Sonnet 18 readable without losing its original language.',
      content: `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate.
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date.
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimmed;
And every fair from fair sometime declines,
By chance, or nature's changing course, untrimmed.`,
      annotations: [
        { phrase: 'thee', note: 'you (archaic singular)' },
        { phrase: 'Thou art', note: 'you are (archaic)' },
        { phrase: 'temperate', note: 'mild, even-natured' },
        { phrase: 'hath', note: 'has (archaic)' },
        { phrase: 'the eye of heaven', note: 'the sun' },
        { phrase: 'every fair', note: 'every beautiful thing' },
        { phrase: 'untrimmed', note: 'stripped of beauty' },
      ],
    },
    {
      stableId: '00000000-0000-4000-8001-000000000201',
      mode: 'ARTICLE',
      collectionStableId: GUEST_ARTICLE_COLLECTION_ID,
      title: 'The Gettysburg Address (Lincoln, 1863)',
      description:
        'Delivered at the dedication of a Civil War cemetery in 1863, Lincoln\'s 272-word address is one of the most studied pieces of English prose. It uses 19th-century formal oratory — fourscore, consecrate, hallow — words that reward a second look even for native speakers. Type the full address; the annotations unpack the vocabulary that time has made unfamiliar.',
      content: `Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.

Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.

But, in a larger sense, we can not dedicate — we can not consecrate — we can not hallow — this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us — that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion — that we here highly resolve that these dead shall not have died in vain — that this nation, under God, shall have a new birth of freedom — and that government of the people, by the people, for the people, shall not perish from the earth.`,
      annotations: [
        { phrase: 'Four score and seven', note: '87 (a score = 20)' },
        { phrase: 'conceived in Liberty', note: 'founded on the idea of freedom' },
        { phrase: 'dedicated to the proposition', note: 'committed to the principle' },
        { phrase: 'so nobly advanced', note: 'carried forward with honor' },
        { phrase: 'consecrate', note: 'declare sacred' },
        { phrase: 'hallow', note: 'honor as holy (stronger than consecrate)' },
        { phrase: 'detract', note: 'take away from its worth' },
        { phrase: 'the last full measure of devotion', note: 'their lives' },
        { phrase: 'shall not perish', note: 'will not be destroyed' },
      ],
    },
    {
      stableId: '00000000-0000-4000-8001-000000000211',
      mode: 'ARTICLE',
      collectionStableId: null,
      title: 'What I Have Lived For (Russell)',
      description:
        'The preface to Bertrand Russell\'s autobiography, written in English and annotated here in Chinese — demonstrating EchoType\'s core use case for Chinese-speaking learners of English. Russell\'s prose is precise and emotionally direct; typing it slowly reveals how carefully each sentence is built.',
      content: `Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like great winds, have blown me hither and thither, in a wayward course, over a deep ocean of anguish, reaching to the very verge of despair.

I have sought love, first, because it brings ecstasy -- ecstasy so great that I would often have sacrificed all the rest of life for a few hours of this joy. I have sought it, next, because it relieves loneliness -- that terrible loneliness in which one shivering consciousness looks over the rim of the world into the cold unfathomable lifeless abyss. I have sought it, finally, because in the union of love I have seen, in a mystic miniature, the prefiguring vision of the heaven that saints and poets have imagined. This is what I sought, and though it might seem too good for human life, this is what -- at last -- I have found.

With equal passion I have sought knowledge. I have wished to understand the hearts of men. I have wished to know why the stars shine. And I have tried to apprehend the Pythagorean power by which number holds sway above the flux. A little of this, but not much, I have achieved.

Love and knowledge, so far as they were possible, led upward toward the heavens. But always pity brought me back to earth. Echoes of cries of pain reverberate in my heart. Children in famine, victims tortured by oppressors, helpless old people a hated burden to their sons, and the whole world of loneliness, poverty, and pain make a mockery of what human life should be. I long to alleviate the evil, but I cannot, and I too suffer.

This has been my life. I have found it worth living, and would gladly live it again if the chance were offered me.`,
      annotations: [
        { phrase: 'overwhelmingly strong', note: '势不可挡的' },
        { phrase: 'hither and thither', note: '到处，四处漂泊' },
        { phrase: 'wayward', note: '任性的，不可预测的' },
        { phrase: 'verge of despair', note: '绝望的边缘' },
        { phrase: 'ecstasy', note: '极度的喜悦，狂喜' },
        { phrase: 'shivering consciousness', note: '颤抖的意识，孤独的自我' },
        { phrase: 'unfathomable', note: '深不可测的' },
        { phrase: 'mystic miniature', note: '神秘的缩影' },
        { phrase: 'prefiguring vision', note: '预示性的幻象' },
        { phrase: 'apprehend', note: '理解，领悟' },
        { phrase: 'holds sway above the flux', note: '支配着万变的世界' },
        { phrase: 'reverberate', note: '回响，萦绕' },
      ],
    },
    {
      stableId: '00000000-0000-4000-8001-000000000212',
      mode: 'ARTICLE',
      collectionStableId: null,
      title: 'On Love (Gibran)',
      description:
        'From The Prophet (1923) by Kahlil Gibran. Written in Biblical prose style — elevated, rhythmic, full of image and metaphor — this is English that native speakers find beautiful but occasionally dense. The annotations unpack the imagery and constructions that give the language its weight.',
      content: `When love beckons to you, follow him,
Though his ways are hard and steep.
And when his wings enfold you yield to him,
Though the sword hidden among his pinions may wound you.
And when he speaks to you believe in him,
Though his voice may shatter your dreams as the north wind lays waste the garden.

For even as love crowns you so shall he crucify you. Even as he is for your growth so is he for your pruning.
Even as he ascends to your height and caresses your tenderest branches that quiver in the sun,
So shall he descend to your roots and shake them in their clinging to the earth.
Like sheaves of corn he gathers you unto himself.
He threshes you to make you naked.
He sifts you to free you from your husks.
He grinds you to whiteness.
He kneads you until you are pliant;
And then he assigns you to his sacred fire, that you may become sacred bread for God's sacred feast.

All these things shall love do unto you that you may know the secrets of your heart, and in that knowledge become a fragment of Life's heart.

But if in your heart you would seek only love's peace and love's pleasure,
Then it is better for you that you cover your nakedness and pass out of love's threshing-floor,
Into the seasonless world where you shall laugh, but not all of your laughter, and weep, but not all of your tears.
Love gives naught but itself and takes naught but from itself.
Love possesses not nor would it be possessed;
For love is sufficient unto love.

When you love you should not say, "God is in my heart," but rather, "I am in the heart of God."
And think not you can direct the course of love, for love, if it finds you worthy, directs your course.

Love has no other desire but to fulfil itself.
But if you love and must needs have desires, let these be your desires:
To melt and be like a running brook that sings its melody to the night.
To know the pain of too much tenderness.
To be wounded by your own understanding of love;
And to bleed willingly and joyfully.
To wake at dawn with a winged heart and give thanks for another day of loving;
To rest at the noon hour and meditate love's ecstasy;
To return home at eventide with gratitude;
And then to sleep with a prayer for the beloved in your heart and a song of praise upon your lips.`,
      annotations: [
        { phrase: 'beckons', note: 'calls you forward' },
        { phrase: 'steep', note: 'sharply difficult to climb' },
        { phrase: 'pinions', note: "a bird's wing feathers" },
        { phrase: 'lays waste', note: 'destroys completely' },
        { phrase: 'crucify', note: 'cause intense suffering' },
        { phrase: 'pruning', note: 'cutting back to encourage growth' },
        { phrase: 'sheaves of corn', note: 'bundles of harvested grain' },
        { phrase: 'threshes', note: 'beats grain to separate seed from stalk' },
        { phrase: 'pliant', note: 'soft and easily shaped' },
        { phrase: 'threshing-floor', note: 'where grain is processed after harvest' },
        { phrase: 'naught', note: 'nothing (archaic)' },
        { phrase: 'sufficient unto', note: 'enough for, complete in itself' },
        { phrase: 'eventide', note: 'evening (archaic)' },
      ],
    },
  ],
};

export const ONBOARDING_CATALOG_VERSION = ONBOARDING_CATALOG.version;

const SEED_TIME = '2026-01-01T00:00:00.000Z';
const COLLECTION_DESCRIPTION_MAX = 1000;

const MODES: CourseMode[] = ['SHORT', 'ARTICLE'];

export function isOnboardingCatalogEmpty(catalog: OnboardingCatalog = ONBOARDING_CATALOG): boolean {
  return catalog.collections.length === 0 && catalog.courses.length === 0;
}

export function buildCatalogAnnotations(
  content: string,
  specs: CatalogAnnotationSpec[],
): Array<Omit<AnnotationDTO, 'id'>> {
  return specs.map(({ phrase, note }) => {
    const startIndex = content.indexOf(phrase);
    if (startIndex < 0) {
      throw new Error(`catalog: phrase not found in content: "${phrase}"`);
    }
    const endIndex = startIndex + phrase.length - 1;
    return {
      startIndex,
      endIndex,
      noteText: note,
      anchoredText: deriveAnchoredText(content, startIndex, endIndex),
    };
  });
}

export type OnboardingCatalogIssue =
  | { code: 'duplicate_stable_id'; stableId: string }
  | { code: 'collection_count'; mode: CourseMode; expected: number; actual: number }
  | { code: 'standalone_count'; mode: CourseMode; expected: number; actual: number }
  | { code: 'collection_course_count'; stableId: string; min: number; max: number; actual: number }
  | { code: 'unknown_collection_ref'; courseStableId: string; collectionStableId: string }
  | { code: 'mode_mismatch'; courseStableId: string; courseMode: CourseMode; collectionMode: CourseMode }
  | { code: 'content_length'; courseStableId: string; mode: CourseMode; length: number }
  | { code: 'collection_description_too_long'; stableId: string; length: number }
  | { code: 'annotation_phrase_missing'; courseStableId: string; phrase: string };

/** Empty catalog is valid (Phase 6.1 shell). Non-empty catalogs enforce Phase 6.2 shape. */
export function validateOnboardingCatalog(
  catalog: OnboardingCatalog,
): OnboardingCatalogIssue[] {
  if (isOnboardingCatalogEmpty(catalog)) {
    return [];
  }

  const issues: OnboardingCatalogIssue[] = [];
  const stableIds = new Set<string>();

  for (const collection of catalog.collections) {
    if (stableIds.has(collection.stableId)) {
      issues.push({ code: 'duplicate_stable_id', stableId: collection.stableId });
    }
    stableIds.add(collection.stableId);
    const descLen = collection.description?.length ?? 0;
    if (descLen > COLLECTION_DESCRIPTION_MAX) {
      issues.push({
        code: 'collection_description_too_long',
        stableId: collection.stableId,
        length: descLen,
      });
    }
  }

  for (const course of catalog.courses) {
    if (stableIds.has(course.stableId)) {
      issues.push({ code: 'duplicate_stable_id', stableId: course.stableId });
    }
    stableIds.add(course.stableId);
  }

  const collectionsByMode = new Map<CourseMode, CatalogCollectionDef[]>();
  for (const mode of MODES) {
    collectionsByMode.set(
      mode,
      catalog.collections.filter((c) => c.mode === mode),
    );
  }

  for (const mode of MODES) {
    const collections = collectionsByMode.get(mode) ?? [];
    if (collections.length !== 1) {
      issues.push({
        code: 'collection_count',
        mode,
        expected: 1,
        actual: collections.length,
      });
    }
  }

  const collectionById = new Map(catalog.collections.map((c) => [c.stableId, c]));

  for (const mode of MODES) {
    const standalone = catalog.courses.filter(
      (c) => c.mode === mode && c.collectionStableId === null,
    );
    if (standalone.length !== 2) {
      issues.push({
        code: 'standalone_count',
        mode,
        expected: 2,
        actual: standalone.length,
      });
    }
  }

  for (const collection of catalog.collections) {
    const members = catalog.courses.filter((c) => c.collectionStableId === collection.stableId);
    if (members.length < 1 || members.length > 2) {
      issues.push({
        code: 'collection_course_count',
        stableId: collection.stableId,
        min: 1,
        max: 2,
        actual: members.length,
      });
    }
  }

  for (const course of catalog.courses) {
    const len = course.content.length;
    if (course.mode === 'SHORT' && (len < SHORT_MIN || len > SHORT_MAX)) {
      issues.push({
        code: 'content_length',
        courseStableId: course.stableId,
        mode: course.mode,
        length: len,
      });
    }
    if (course.mode === 'ARTICLE' && (len < ARTICLE_MIN || len > ARTICLE_MAX)) {
      issues.push({
        code: 'content_length',
        courseStableId: course.stableId,
        mode: course.mode,
        length: len,
      });
    }

    if (course.collectionStableId) {
      const collection = collectionById.get(course.collectionStableId);
      if (!collection) {
        issues.push({
          code: 'unknown_collection_ref',
          courseStableId: course.stableId,
          collectionStableId: course.collectionStableId,
        });
      } else if (collection.mode !== course.mode) {
        issues.push({
          code: 'mode_mismatch',
          courseStableId: course.stableId,
          courseMode: course.mode,
          collectionMode: collection.mode,
        });
      }
    }

    for (const { phrase } of course.annotations) {
      if (!course.content.includes(phrase)) {
        issues.push({
          code: 'annotation_phrase_missing',
          courseStableId: course.stableId,
          phrase,
        });
      }
    }
  }

  return issues;
}

export function assertValidOnboardingCatalog(catalog: OnboardingCatalog = ONBOARDING_CATALOG): void {
  const issues = validateOnboardingCatalog(catalog);
  if (issues.length > 0) {
    throw new Error(`invalid onboarding catalog: ${JSON.stringify(issues[0])}`);
  }
}

export type GuestCategoryRecord = {
  id: string;
  name: string;
  mode: CourseMode;
  description: string | null;
  isReadOnly: true;
  createdAt: string;
  updatedAt: string;
};

export type GuestCourseRecord = {
  id: string;
  title: string;
  content: string;
  mode: CourseMode;
  categoryId: string | null;
  description: string | null;
  annotations: AnnotationDTO[];
  createdAt: string;
  updatedAt: string;
  isReadOnly: boolean;
  source: 'onboarding' | 'guest';
};

const EMPTY_STATS_ROW = {
  totalDurationSec: 0,
  totalCompletedPasses: 0,
  sessionCount: 0,
  totalCharCount: 0,
  totalWpmCharSum: 0,
  totalAccCharSum: 0,
  lastPracticedAt: null as null,
};

export function emptyCourseStats() {
  return courseStatsFromRow(EMPTY_STATS_ROW);
}

export function emptyCategoryRollup() {
  return categoryRollupFromMembers([]);
}

/** Build guest-store onboarding categories + courses (read-only) from catalog. */
export function materializeOnboardingGuestRecords(
  catalog: OnboardingCatalog = ONBOARDING_CATALOG,
): {
  categories: GuestCategoryRecord[];
  courses: GuestCourseRecord[];
} {
  assertValidOnboardingCatalog(catalog);

  const categories: GuestCategoryRecord[] = catalog.collections.map((def) => ({
    id: def.stableId,
    name: def.name,
    mode: def.mode,
    description: def.description,
    isReadOnly: true as const,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));

  const categoryIdByStableId = new Map(catalog.collections.map((c) => [c.stableId, c.stableId]));

  const courses: GuestCourseRecord[] = catalog.courses.map((def) => {
    const categoryId = def.collectionStableId
      ? (categoryIdByStableId.get(def.collectionStableId) ?? null)
      : null;
    const built = buildCatalogAnnotations(def.content, def.annotations);
    return {
      id: def.stableId,
      title: def.title,
      content: def.content,
      mode: def.mode,
      categoryId,
      description: def.description ?? null,
      annotations: built.map((a, i) => ({
        ...a,
        id: `onboarding-ann-${def.stableId}-${i}`,
      })),
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      isReadOnly: true,
      source: 'onboarding' as const,
    };
  });

  return { categories, courses };
}

export function guestCourseToDTO(
  record: GuestCourseRecord,
  categoryName: string | null,
): CourseDTO {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    mode: record.mode,
    categoryId: record.categoryId,
    categoryName,
    description: record.description,
    annotations: record.annotations,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    stats: emptyCourseStats(),
    lastPracticeHere: false,
  };
}

export function guestCategoryToDTO(
  record: GuestCategoryRecord,
  courseCount: number,
): CategoryDTO {
  return {
    id: record.id,
    name: record.name,
    mode: record.mode,
    description: record.description,
    courseCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rollup: emptyCategoryRollup(),
    lastPracticeHere: false,
  };
}
