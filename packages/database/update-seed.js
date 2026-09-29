const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.platformSetting.update({
    where: { key: 'DEMO_CLASS_FEE' },
    data: { value: '2900', description: 'Demo class fee in paise (₹29), paid by student — 100% goes to admin' }
  });
  console.log('Updated db setting');
}
main().catch(console.error).finally(() => prisma.$disconnect());
