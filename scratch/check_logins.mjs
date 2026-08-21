import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const attempts = await prisma.loginAttempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("Latest login attempts:", attempts);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
