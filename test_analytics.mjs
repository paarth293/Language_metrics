import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  try {
    console.log('Testing queries...');
    
    await db.classSession.count({ where: { status: 'COMPLETED' } });
    await db.booking.count({ where: { status: 'CANCELLED' } });
    await db.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } });
    await db.studentProfile.count({ where: { user: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } });
    await db.studentProfile.count();
    await db.teacherProfile.count();
    await db.course.count({ where: { published: true } });
    
    await db.review.aggregate({ _avg: { rating: true } });
    
    await db.teacherProfile.findMany({
      orderBy: { reviews: { _count: 'desc' } },
      take: 5,
      include: { user: true },
    });
    
    await db.language.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { courses: true } } },
      orderBy: { name: 'asc' },
    });
    
    console.log('All queries successful!');
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await db.$disconnect();
  }
}
main();
