import { isOnboardingCatalogEmpty, ONBOARDING_CATALOG } from '@echotype/shared';
import { DEV_QA_COURSES } from './fixtures/devQaCourses.js';
import {
  materializeCoursesForUser,
  materializeOnboardingForUser,
  upsertLocalDevUser,
} from './fixtures/materializeCourse.js';
import { PrismaClient } from '@prisma/client';
import { LOCAL_DEV_USER_ID } from '../src/localDevUser.js';

const prisma = new PrismaClient();

const devUserId = process.env.DEMO_USER_ID ?? LOCAL_DEV_USER_ID;

async function main() {
  const user = await upsertLocalDevUser(prisma, devUserId);

  if (!isOnboardingCatalogEmpty(ONBOARDING_CATALOG)) {
    await materializeOnboardingForUser(prisma, user.id, ONBOARDING_CATALOG);
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingSeededAt: new Date() },
    });
  }

  await materializeCoursesForUser(prisma, user.id, DEV_QA_COURSES);
  console.log(`Dev seed complete. User: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
