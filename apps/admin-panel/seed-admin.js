/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('12345678', 4);
  await db.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, role: 'ADMIN' },
    create: {
      id: require('crypto').randomUUID(),
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'ADMIN'
    }
  });
  console.log('Admin seeded');
}

main().catch(console.error).finally(() => db.$disconnect());
