/**
 * src/lib/zoho-mailer.ts — Nodemailer transporter for Zoho Mail SMTP
 *
 * Uses the ZOHO_EMAIL account as SMTP auth and sends from the
 * verified alias no-reply@languagemetrics.in.
 *
 * Environment variables required:
 *   ZOHO_EMAIL          — SMTP auth username (riyansh.gupta@languagemetrics.in)
 *   ZOHO_APP_PASSWORD   — App-specific password for that account
 *   ZOHO_SMTP_HOST      — smtp.zoho.in
 *   ZOHO_SMTP_PORT      — 465 (SSL)
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const host = process.env.ZOHO_SMTP_HOST;
  const port = Number(process.env.ZOHO_SMTP_PORT || "465");
  const user = process.env.ZOHO_EMAIL;
  const pass = process.env.ZOHO_APP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
  });

  return _transporter;
}

const FROM = process.env.EMAIL_FROM || `"Language Metrics" <no-reply@languagemetrics.in>`;

/**
 * Send an email through Zoho SMTP, Resend API, or Dev Terminal Log fallback.
 *
 * @param to      — Recipient email address
 * @param subject — Email subject line
 * @param html    — Email body (HTML)
 */
export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // 1. Try Zoho SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: FROM,
        replyTo: FROM,
        to,
        subject,
        html,
      });
      return;
    } catch (err) {
      console.warn("[Zoho SMTP Warning] Failed to send email via Zoho:", err);
    }
  }

  // 2. Try Resend API (configured in .env)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const resendFrom = process.env.EMAIL_FROM || "Language Metrics <onboarding@resend.dev>";
      const result = await resend.emails.send({
        from: resendFrom,
        to,
        subject,
        html,
      });
      if (result.data) {
        console.log(`[Resend Email Success] Sent to ${to}, ID: ${result.data.id}`);
        return;
      }
      if (result.error) {
        console.warn("[Resend Email Warning]", result.error);
      }
    } catch (err) {
      console.warn("[Resend Email Exception]", err);
    }
  }

  // 3. Dev Mode / Unconfigured fallback (Console Log)
  console.log(`\n==================================================`);
  console.log(`[DEV EMAIL FALLBACK] Email dispatch requested`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  const otpMatch = html.match(/>\s*(\d{6})\s*</);
  if (otpMatch?.[1]) {
    console.log(`🔑 VERIFICATION OTP CODE: ${otpMatch[1]}`);
  }
  console.log(`==================================================\n`);
}

