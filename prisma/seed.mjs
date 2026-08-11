/**
 * Idempotent admin seed.
 * Creates (or updates) a single ADMIN user from environment variables.
 *
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * Run with:  npm run db:seed
 * (loads .env via node --env-file)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME || "Platform Admin";
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env to seed the admin account."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert the user, then ensure the linked Admin row exists — idempotent.
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN" },
    create: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      admin: { create: {} },
    },
    include: { admin: true },
  });

  if (!user.admin) {
    await prisma.admin.create({ data: { userId: user.id } });
  }

  console.log(`✔ Admin ready: ${email}`);
}

main()
  .catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
