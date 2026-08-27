/**
 * src/lib/otp.ts — OTP generation & verification helpers
 *
 * Uses crypto.randomInt for cryptographically secure generation
 * and bcryptjs for hashing/comparison (timing-safe).
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

const OTP_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a cryptographically random 6-digit numeric OTP.
 * Always returns exactly 6 digits (range: 100000–999999).
 */
export function generateOtp(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

/**
 * Hash an OTP string using bcrypt (10 rounds).
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext OTP against a bcrypt hash.
 * Returns true if they match.
 */
export async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
