
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@gmail.com";
  const password = "12345678";
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  const userId = crypto.randomUUID();

  // Create User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      emailVerified: true,
      role: "ADMIN"
    },
    create: {
      id: userId,
      email,
      passwordHash,
      emailVerified: true,
      role: "ADMIN"
    }
  });

  console.log("User created:", user.id);

  // Create AdminUser
  const adminUser = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      isSuperAdmin: true,
      status: "ACTIVE"
    },
    create: {
      userId: user.id,
      name: "Admin",
      email,
      passwordHash,
      roleKey: "SUPER_ADMIN",
      isSuperAdmin: true,
      status: "ACTIVE"
    }
  });

  console.log("AdminUser created/updated:", adminUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
