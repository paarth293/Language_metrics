import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = "admin@gmail.com";
  const password = "12345678";
  
  // Create a UUID for the user
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Seeding admin user: ${email}`);

  // Upsert the core User
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      id: userId,
      email,
      role: "ADMIN"
    }
  });

  // Upsert the AdminUser
  await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      roleKey: "SUPER_ADMIN",
      isSuperAdmin: true,
      status: "ACTIVE"
    },
    create: {
      userId: user.id,
      email,
      name: "Admin Portal",
      passwordHash,
      roleKey: "SUPER_ADMIN",
      isSuperAdmin: true,
      status: "ACTIVE"
    }
  });

  console.log("Admin seeded successfully.");
}

seedAdmin()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
