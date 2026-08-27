/**
 * lib/email.ts — Email sending via Resend
 */

import { Resend } from "resend";

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
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Verify your email</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f5; text-align: center; border-radius: 6px; letter-spacing: 4px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code expires in 5 minutes.</p>
          <p style="color: #71717a; font-size: 14px; margin-top: 40px;">
            If you did not create this account, you can safely ignore this email.
          </p>
        </div>
      `,
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
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
