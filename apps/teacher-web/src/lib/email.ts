/**
 * lib/email.ts — Email sending via Resend
 */

import { Resend } from "resend";
import { OTPVerificationEmail, VerificationEmail, PasswordResetEmail } from "./templates";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // In dev without keys, log a warning and skip sending
      console.warn("RESEND_API_KEY is not configured. Emails will not be sent.");
      throw new Error("RESEND_API_KEY is not set.");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Language Metrics <noreply@languagemetrics.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Sends a 6-digit OTP verification code via email.
 * Used by the OTP-based email verification flow during registration.
 */
export async function sendVerificationOTP(email: string, otp: string): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Verify your email address",
      react: OTPVerificationEmail({ otp }),
    });
    return true;
  } catch (error) {
    console.error("Error sending verification OTP:", error);
    return false;
  }
}

/**
 * Sends a verification link email.
 * Used by the token-link email verification flow (e.g. OAuth onboarding).
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Verify your Language Metrics account",
    react: VerificationEmail({ name, link }),
  });
}

/**
 * Sends a password reset link email.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your Language Metrics password",
    react: PasswordResetEmail({ name, link }),
  });
}
