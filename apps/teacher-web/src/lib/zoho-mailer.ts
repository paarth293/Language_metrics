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
import { Resend, type CreateEmailRequestOptions } from "resend";
import { log } from "@repo/logger";
import { printForDevelopment } from "./dev-console";

/**
 * nodemailer's defaults (2 min to connect, 30 s for the greeting, 10 min idle)
 * would hold a request open far longer than any function should run.
 * Exported so tests can shorten them.
 */
export const SMTP_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 };

/** Resend has no timeout option; a signal passed with the request bounds it. */
const RESEND_TIMEOUT_MS = 10_000;

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
    ...SMTP_TIMEOUTS,
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
      log.warn("[Zoho SMTP Warning] Failed to send email via Zoho", { error: err });
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
      }, { signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) } as CreateEmailRequestOptions); // `signal` is not in the SDK's option type
      if (result.data) {
        log.info("[Resend Email Success]", { to, id: result.data.id });
        return;
      }
      if (result.error) {
        log.warn("[Resend Email Warning]", { detail: result.error });
      }
    } catch (err) {
      log.warn("[Resend Email Exception]", { error: err });
    }
  }

  // 3. Nothing delivered it. In production say so without the body (it may
  // hold an OTP); in local development print it so sign-up can continue.
  if (process.env.NODE_ENV === "production") {
    log.error("[email] No email provider delivered the message", { to, subject });
    return;
  }
  const otpMatch = html.match(/>\s*(\d{6})\s*</);
  printForDevelopment([
    "[DEV EMAIL FALLBACK] Email dispatch requested",
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(otpMatch?.[1] ? [`🔑 VERIFICATION OTP CODE: ${otpMatch[1]}`] : []),
  ]);
}

