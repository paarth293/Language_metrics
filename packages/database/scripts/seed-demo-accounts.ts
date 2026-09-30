import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = "DemoPassword123!";
  const passwordHash = await bcrypt.hash(password, 12);

  // 1. Create Demo Teacher
  const teacherEmail = "teacher@example.com";
  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: teacherEmail,
      role: "TEACHER",
      passwordHash,
      emailVerified: true,
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: { status: "APPROVED", onboardingComplete: true },
    create: {
      userId: teacherUser.id,
      name: "Demo Teacher",
      experienceLevel: "EXPERIENCED",
      status: "APPROVED",
      onboardingComplete: true,
      language: "Spanish",
      languages: ["Spanish", "English"],
    },
  });

  // 2. Create Demo Student
  const studentEmail = "student@example.com";
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: studentEmail,
      role: "STUDENT",
      passwordHash,
      emailVerified: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: { onboardingComplete: true },
    create: {
      userId: studentUser.id,
      name: "Demo Student",
      languageToLearn: "Spanish",
      proficiencyLevel: "A1",
      onboardingComplete: true,
    },
  });

  console.log("Demo accounts created successfully.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
