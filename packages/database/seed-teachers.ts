import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy teachers...');

  // 1. Approved Teacher
  const approvedUserId = uuidv4();
  await prisma.user.create({
    data: {
      id: approvedUserId,
      email: 'approved.teacher@example.com',
      role: 'TEACHER',
      teacherProfile: {
        create: {
          name: 'Sarah Approved',
          experienceLevel: 'EXPERIENCED',
          status: 'APPROVED',
          language: 'spanish',
          gender: 'female',
          bio: 'I am a very experienced Spanish teacher.',
        }
      }
    }
  });
  console.log('Created approved teacher.');

  // 2. Suspended / Rejected Teacher
  const rejectedUserId = uuidv4();
  await prisma.user.create({
    data: {
      id: rejectedUserId,
      email: 'rejected.teacher@example.com',
      role: 'TEACHER',
      teacherProfile: {
        create: {
          name: 'John Suspended',
          experienceLevel: 'FRESHER',
          status: 'REJECTED',
          language: 'french',
          gender: 'male',
          bio: 'I want to teach French.',
        }
      }
    }
  });
  console.log('Created rejected teacher.');
  
  // 3. Another Approved Teacher
  const approvedUserId2 = uuidv4();
  await prisma.user.create({
    data: {
      id: approvedUserId2,
      email: 'approved.sensei@example.com',
      role: 'TEACHER',
      teacherProfile: {
        create: {
          name: 'Kenji Approved',
          experienceLevel: 'EXPERIENCED',
          status: 'APPROVED',
          language: 'japanese',
          gender: 'male',
          bio: 'Japanese native speaker with 10 years experience.',
        }
      }
    }
  });
  console.log('Created another approved teacher.');

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
