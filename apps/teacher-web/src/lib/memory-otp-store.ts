/**
 * src/lib/memory-otp-store.ts — Shared in-memory fallback store for registration OTPs
 * Used in development environment when Redis is unavailable.
 */

interface OtpEntry {
  hash: string;
  expiresAt: number;
}

const otpHashes = new Map<string, OtpEntry>();
const verifiedEmails = new Map<string, number>();

export const memoryOtpStore = {
  setHash(email: string, hash: string, ttlMs: number = 10 * 60 * 1000) {
    otpHashes.set(email.toLowerCase().trim(), {
      hash,
      expiresAt: Date.now() + ttlMs,
    });
  },
  getHash(email: string): string | null {
    const key = email.toLowerCase().trim();
    const entry = otpHashes.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      otpHashes.delete(key);
      return null;
    }
    return entry.hash;
  },
  deleteHash(email: string) {
    otpHashes.delete(email.toLowerCase().trim());
  },
  setVerified(email: string, ttlMs: number = 30 * 60 * 1000) {
    verifiedEmails.set(email.toLowerCase().trim(), Date.now() + ttlMs);
  },
  isVerified(email: string): boolean {
    const key = email.toLowerCase().trim();
    const expiresAt = verifiedEmails.get(key);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      verifiedEmails.delete(key);
      return false;
    }
    return true;
  },
};
