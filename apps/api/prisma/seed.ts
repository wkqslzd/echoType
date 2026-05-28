import { PrismaClient, CourseMode } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo-user';

const STRAY_BIRDS_49 = `I thank thee that I am none of the wheels of power but I am one with the living creatures that are crushed by it.`;

const WHAT_I_HAVE_LIVED_FOR = `Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like great winds, have blown me hither and thither, in a wayward course, over a deep ocean of anguish, reaching to the very verge of despair. I have sought love, first, because it brings ecstasy - ecstasy so great that I would often have sacrificed all the rest of life for a few hours of this joy. I have sought it, next, because it relieves loneliness - that terrible loneliness in which one shivering consciousness looks over the rim of the world into the cold unfathomable lifeless abyss. I have sought it, finally, because in the union of love I have seen, in a mystic miniature, the prefiguring vision of the heaven that saints and poets have imagined. This is what I sought, and though it might seem too good for human life, this is what - at last - I have found.`;

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

  const existingShort = await prisma.course.findFirst({
    where: { userId: user.id, title: 'Stray Birds - 49' },
  });
  if (!existingShort) {
    await prisma.course.create({
      data: {
        userId: user.id,
        categoryId: strayBirdsCategory.id,
        title: 'Stray Birds - 49',
        content: STRAY_BIRDS_49,
        mode: CourseMode.SHORT,
      },
    });
  }

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
