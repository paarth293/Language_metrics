/**
 * Bootstrap / rotate an admin account for the admin panel.
 *
 * Creates (or updates) a User row plus the AdminUser credential row that the
 * panel authenticates against. Passwords are bcrypt-hashed (cost 12) before
 * they ever reach the database.
 *
 * Usage (from repo root, loads root .env with the DB creds):
 *   ADMIN_EMAIL=admin@languagemetrics.com \
 *   ADMIN_NAME="Platform Admin" \
 *   ADMIN_PASSWORD="a-very-strong-password" \
 *   ADMIN_ROLE=SUPER_ADMIN \
 *   node --env-file=.env apps/admin-panel/scripts/create-admin.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function fail(msg) {
  console.error(`[create-admin] ${msg}`);
  process.exit(1);
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || "Platform Admin";
  const password = process.env.ADMIN_PASSWORD;
  const roleKey = process.env.ADMIN_ROLE || "SUPER_ADMIN";

  if (!email || !password) {
    fail("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("ADMIN_EMAIL is not a valid email address.");
  }
  if (password.length < 12) {
    fail("ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (!["SUPER_ADMIN", "FINANCE_ADMIN", "TEACHER_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"].includes(roleKey)) {
    fail("ADMIN_ROLE must be one of SUPER_ADMIN, FINANCE_ADMIN, TEACHER_ADMIN, SUPPORT_ADMIN, CONTENT_ADMIN.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { id: crypto.randomUUID(), email, role: "ADMIN" },
  });

  await prisma.adminUser.upsert({
    where: { userId: user.id },
    update: {
      name,
      email: user.email,
      passwordHash,
      roleKey,
      status: "ACTIVE",
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    },
    create: {
      userId: user.id,
      name,
      email: user.email,
      passwordHash,
      roleKey,
      status: "ACTIVE",
      isSuperAdmin: roleKey === "SUPER_ADMIN",
    },
  });

  console.log(`[create-admin] Admin ready: ${email} (role: ${roleKey}, id: ${user.id})`);
  console.log("[create-admin] NEVER share the password; rotate it via the panel or re-run this script.");
}

main()
  .catch((err) => {
    console.error("[create-admin] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
