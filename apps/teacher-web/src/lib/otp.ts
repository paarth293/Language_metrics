import crypto from "crypto";

export function generateEmailOTP(): string {
  // Generate a random 6-digit number between 100000 and 999999
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
}

export function hashOTP(otp: string): string {
  // Use SHA-256 to hash the OTP for secure database storage
  return crypto.createHash("sha256").update(otp).digest("hex");
}
