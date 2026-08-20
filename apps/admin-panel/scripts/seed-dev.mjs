/**
 * Optional dev seed for the NEW admin-panel tables (languages, courses,
 * coupons, invoices, complaints, security events, notification templates).
 * Run only in non-production environments:
 *   node --env-file=.env apps/admin-panel/scripts/seed-dev.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("[seed-dev] Refusing to run in production.");
    process.exit(0);
  }

  const languages = [
    { name: "French", code: "fr", levels: 6, flagEmoji: "🇫🇷" },
    { name: "Spanish", code: "es", levels: 6, flagEmoji: "🇪🇸" },
    { name: "German", code: "de", levels: 6, flagEmoji: "🇩🇪" },
    { name: "Japanese", code: "ja", levels: 5, flagEmoji: "🇯🇵" },
    { name: "Mandarin", code: "zh", levels: 6, flagEmoji: "🇨🇳" },
  ];
  for (const l of languages) {
    await prisma.language.upsert({
      where: { code: l.code },
      update: {},
      create: l,
    });
  }
  console.log(`[seed-dev] Upserted ${languages.length} languages.`);

  const fr = await prisma.language.findUnique({ where: { code: "fr" } });
  const es = await prisma.language.findUnique({ where: { code: "es" } });
  if (fr) {
    await prisma.course.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        languageId: fr.id,
        name: "French A1 Foundation",
        level: "A1",
        price: 1500000,
        durationWeeks: 8,
        classCount: 24,
        classDurationMin: 45,
        status: "ACTIVE",
        published: true,
      },
    });
    await prisma.course.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        languageId: fr.id,
        name: "French A2 Conversation",
        level: "A2",
        price: 1800000,
        durationWeeks: 8,
        classCount: 24,
        classDurationMin: 45,
        status: "ACTIVE",
        published: true,
      },
    });
  }
  if (es) {
    await prisma.course.upsert({
      where: { id: "00000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000003",
        languageId: es.id,
        name: "Spanish for Beginners",
        level: "A1",
        price: 1200000,
        durationWeeks: 8,
        classCount: 20,
        classDurationMin: 45,
        status: "ACTIVE",
        published: true,
      },
    });
  }
  console.log("[seed-dev] Upserted sample courses.");

  const complaints = [
    {
      ticketNumber: "LM1024",
      category: "CONTACT_SHARING",
      subject: "Teacher asked for my WhatsApp number",
      description: "During class the teacher requested my personal WhatsApp to share materials.",
      status: "INVESTIGATING",
      severity: "HIGH",
    },
    {
      ticketNumber: "LM1025",
      category: "PAYMENT",
      subject: "Payment charged twice",
      description: "Student reports duplicate charge for a booking.",
      status: "NEW",
      severity: "MEDIUM",
    },
  ];
  for (const c of complaints) {
    await prisma.complaint.upsert({ where: { ticketNumber: c.ticketNumber }, update: {}, create: c });
  }
  console.log("[seed-dev] Upserted sample complaints.");

  const coupons = [
    {
      code: "WELCOME10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      scope: "GLOBAL",
      maxUses: 500,
    },
    {
      code: "FRENCH50",
      discountType: "FIXED",
      discountValue: 5000,
      scope: "LANGUAGE",
      scopeTargetId: fr?.id ?? null,
      minOrderValue: 100000,
    },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: {}, create: c });
  }
  console.log("[seed-dev] Upserted sample coupons.");

  const securityEvents = [
    {
      type: "CONTACT_SHARING",
      severity: "WARN",
      details: JSON.stringify({ message: "Potential WhatsApp number shared in chat", actor: "teacher" }),
    },
    {
      type: "SUSPICIOUS_ACTIVITY",
      severity: "CRITICAL",
      details: JSON.stringify({ message: "Rapid failed login burst detected" }),
    },
  ];
  for (const e of securityEvents) {
    await prisma.securityEvent.create({ data: e });
  }
  console.log("[seed-dev] Inserted sample security events.");

  const templates = [
    { name: "Class Starting Soon", channel: "PUSH", title: "Your class starts soon", body: "Your class begins in 30 minutes.", audience: "ALL_STUDENTS" },
    { name: "Teacher Assigned", channel: "EMAIL", title: "Teacher assigned", body: "Your teacher has been assigned.", audience: "ALL_STUDENTS" },
    { name: "Payout Processed", channel: "INAPP", title: "Payout processed", body: "Your payout has been processed.", audience: "ALL_TEACHERS" },
  ];
  for (const t of templates) {
    await prisma.notificationTemplate.create({ data: t });
  }
  console.log("[seed-dev] Inserted sample notification templates.");

  console.log("[seed-dev] Done.");
}

main()
  .catch((e) => {
    console.error("[seed-dev] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
