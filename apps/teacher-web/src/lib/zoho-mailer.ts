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

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.ZOHO_SMTP_HOST;
  const port = Number(process.env.ZOHO_SMTP_PORT || "465");
  const user = process.env.ZOHO_EMAIL;
  const pass = process.env.ZOHO_APP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      "Zoho SMTP env vars are not set (ZOHO_SMTP_HOST, ZOHO_EMAIL, ZOHO_APP_PASSWORD). Email sending will not work."
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
  });

  return _transporter;
}

const FROM = `"Language Metrics" <no-reply@languagemetrics.in>`;

/**
 * Send an email through Zoho SMTP.
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
  const transporter = getTransporter();
  await transporter.sendMail({
    from: FROM,
    replyTo: FROM, // Points to no-reply — discourages replies
    to,
    subject,
    html,
  });
}
