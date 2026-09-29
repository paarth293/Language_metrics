const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const teachers = await prisma.teacherProfile.findMany({ include: { user: true, rates: true, availability: true } });
  console.log(JSON.stringify(teachers.map(t => ({
    id: t.userId,
    name: t.name,
    gender: t.gender,
    experience: t.experienceLevel,
    hourlyRate: t.rates.find(r => r.type === 'HOURLY')?.amount,
    hasAvailability: t.availability.length > 0
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
