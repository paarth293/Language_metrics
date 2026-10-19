/**
 * lib/email.ts — Email sending via Resend
 */

import { Resend, type CreateEmailRequestOptions } from "resend";
import { VerificationEmail, PasswordResetEmail } from "./templates";
import { sendMail } from "./zoho-mailer";
import { log } from "@repo/logger";

let _resend: Resend | null = null;

/**
 * Resend's SDK has no timeout option, but it passes request options through to
 * fetch, so an abort signal bounds the call. On timeout Resend returns
 * `{ error }` rather than throwing.
 */
const RESEND_TIMEOUT_MS = 10_000;
// `signal` is not in the SDK's option type, hence the cast.
const resendTimeout = () => ({ signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) }) as CreateEmailRequestOptions;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // In dev without keys, log a warning and skip sending
      log.warn("RESEND_API_KEY is not configured. Emails will not be sent.");
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
    const html = `
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
    `;
    await sendMail({
      to: email,
      subject: "Verify your email address",
      html,
    });
    return true;
  } catch (error) {
    log.error("Error sending verification OTP", { error: error });
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
  }, resendTimeout());
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
  }, resendTimeout());
}

/**
 * Sends a 6-digit OTP verification code for password reset via email.
 */
export async function sendPasswordResetOTP(email: string, otp: string): Promise<boolean> {
  try {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Reset your password</h2>
        <p>We received a request to reset the password for your Language Metrics account.</p>
        <p>Your password reset code is:</p>
        <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f5; text-align: center; border-radius: 6px; letter-spacing: 4px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #71717a; font-size: 14px; margin-top: 40px;">
          If you did not request a password reset, you can safely ignore this email. Your password will not be changed.
        </p>
      </div>
    `;
    await sendMail({
      to: email,
      subject: "Password Reset Code",
      html,
    });
    return true;
  } catch (error) {
    log.error("Error sending password reset OTP", { error: error });
    return false;
  }
}
