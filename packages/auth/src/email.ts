/**
 * @repo/auth — Email helpers using Resend
 *
 * All emails are sent from the configured EMAIL_FROM address.
 * Templates are kept intentionally simple — brand them up later.
 */

import { Resend } from "resend";

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
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin-bottom:8px">Hi ${name} 👋</h2>
        <p style="color:#4e5674;margin-bottom:24px">
          Thanks for joining Language Metrics! Please verify your email address to activate your account.
        </p>
        <a href="${link}" style="display:inline-block;background:#c7982f;color:#fff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">
          Verify Email Address
        </a>
        <p style="color:#8a93a6;font-size:13px;margin-top:24px">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
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
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin-bottom:8px">Reset your password</h2>
        <p style="color:#4e5674;margin-bottom:24px">
          Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.
        </p>
        <a href="${link}" style="display:inline-block;background:#c7982f;color:#fff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">
          Reset Password
        </a>
        <p style="color:#8a93a6;font-size:13px;margin-top:24px">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          Your password will not be changed.
        </p>
      </div>
    `,
  });
}
