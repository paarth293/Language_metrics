/**
 * Idempotent seed script.
 *
 * Seeds two things:
 *   1. PlatformSetting defaults (key-value config the Admin app can change at runtime)
 *   2. A single ADMIN user from environment variables
 *
 * Environment variables required for the Admin user:
 *   ADMIN_NAME     (optional, defaults to "Platform Admin")
 *   ADMIN_EMAIL    (required)
 *   ADMIN_PASSWORD (required)
 *
 * Run with:  npm run db:seed
 * (loads .env via node --env-file)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// PLATFORM SETTINGS
// All money values are in paise (1 INR = 100 paise).
// ---------------------------------------------------------------------------
const PLATFORM_SETTINGS = [
  {
    key: "COMMISSION_PCT",
    value: "30",
    description:
      "Platform commission % taken from each class or course fee (e.g. 30 = 30%)",
  },
  {
    key: "TEACHER_REGISTRATION_FEE",
    value: "39900", // ₹399
    description:
      "Teacher registration fee in paise (₹399), charged after admin approval",
  },
  {
    key: "DEMO_CLASS_FEE",
    value: "4900", // ₹49
    description:
      "Demo class fee in paise (₹49), paid by student — 100% goes to admin",
  },
  {
    key: "RECORDING_EXPIRY_DAYS",
    value: "15",
    description:
      "Days after which class recordings are auto-deleted from storage",
  },
  {
    key: "OUTREACH_MESSAGE_COIN_COST",
    value: "50",
    description:
      "Number of coins a teacher must spend to send one outreach message to a student",
  },
  {
    key: "COIN_TO_INR_RATE",
    value: "1", // 1 coin = ₹1
    description:
      "Conversion rate used when teachers purchase coins (1 coin = ₹1 = 100 paise)",
  },
];

async function seedPlatformSettings() {
  for (const setting of PLATFORM_SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        description: setting.description,
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    });
  }

  console.log(`✔ Seeded ${PLATFORM_SETTINGS.length} platform settings`);
}

// ---------------------------------------------------------------------------
// ADMIN USER
// NOTE: Supabase auth.users owns authentication. This row in the public.User
// table mirrors auth.users.id and stores the role — it does NOT store passwords.
// The adminId must match an existing auth.users.id in Supabase.
// For local dev, set ADMIN_SUPABASE_USER_ID to a UUID from your Supabase project.
// ---------------------------------------------------------------------------
async function seedAdminUser() {
  const adminId = process.env.ADMIN_SUPABASE_USER_ID;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminId || !adminEmail) {
    console.warn(
      "⚠  Skipping admin user seed: ADMIN_SUPABASE_USER_ID and ADMIN_EMAIL are not set in .env."
    );
    console.warn(
      "   Set both variables to seed the Admin profile row in public.User."
    );
    return;
  }

  await prisma.user.upsert({
    where: { id: adminId },
    update: { role: "ADMIN", email: adminEmail },
    create: {
      id: adminId,
      role: "ADMIN",
      email: adminEmail,
    },
  });

  console.log(`✔ Admin user ready: ${adminEmail} (id: ${adminId})`);
}

async function main() {
  console.log("🌱 Starting seed...\n");

  await seedPlatformSettings();
  await seedAdminUser();

  console.log("\n✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
