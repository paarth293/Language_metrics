import { PrismaClient } from "@prisma/client";
import { onPrismaError } from "./db-alerts";

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: [
      // Errors go through @repo/logger (JSON, secrets masked) and raise an
      // ops alert when the database is down (#8e).
      { emit: "event", level: "error" },
      { emit: "stdout", level: "warn" },
      ...(process.env.NODE_ENV === "production" ? [] : [{ emit: "stdout" as const, level: "query" as const }]),
    ],
  });
  client.$on("error", onPrismaError);
  return client;
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// In production (serverless), always create a new client to avoid stale connections.
// In development, reuse the global to avoid exhausting connections on HMR.
export const db =
  process.env.NODE_ENV === "production"
    ? prismaClientSingleton()
    : (globalThis.prismaGlobal ?? prismaClientSingleton());

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;

/**
 * A separate client holding exactly one connection, on DIRECT_URL (not
 * pooled) when it is set, else DATABASE_URL. For session-scoped state such as
 * advisory locks: behind a transaction-mode pooler, a lock and its unlock can
 * land on different server connections. The caller must `$disconnect()` it.
 */
export function openDirectConnection(): PrismaClient {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  const datasourceUrl = `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
  return new PrismaClient({ datasourceUrl, log: ["error"] });
}

export type * from "@prisma/client";
export {
  Prisma,
  PrismaClient,
  UserRole,
  StudentStatus,
  TeacherExperienceLevel,
  VerificationStatus,
  DocumentType,
  DocumentStatus,
  InterviewStatus,
  CoinTransactionType,
  RateType,
  BookingType,
  BookingStatus,
  SessionStatus,
  NoShowParty,
  RecordingStatus,
  RecordingMode,
  LiveParticipantRole,
  SessionBillingStatus,
  PaymentType,
  PaymentStatus,
  PayoutStatus,
  NotificationType,
  AdminUserStatus,
  LanguageStatus,
  CourseStatus,
  CouponDiscountType,
  CouponScope,
  BillingType,
  InvoiceStatus,
  ComplaintCategory,
  ComplaintStatus,
  NotificationChannel
} from "@prisma/client";

// Coin ledger — atomic balance operations. Prefer these over hand-written
// CoinTransaction writes; see coin-ledger.ts for why.
export * from "./coin-ledger";
