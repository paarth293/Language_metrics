/**
 * @repo/auth — Email helpers using Resend
 *
 * All emails are sent from the configured EMAIL_FROM address.
 * Templates are kept intentionally simple — brand them up later.
 */

import { Resend } from "resend";
import { VerificationEmail, PasswordResetEmail } from "./templates";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set. Email sending will not work.");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Language Metrics <noreply@languagemetrics.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Email verification ────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Language Metrics account",
    react: VerificationEmail({ name, link }),
  });
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Language Metrics password",
    react: PasswordResetEmail({ name, link }),
  });
}
