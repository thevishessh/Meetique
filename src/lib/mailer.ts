import { Resend } from "resend";
import { APP_NAME } from "./config";

/**
 * Sends a plain-text email through Resend. Returns false (and logs) when email is not configured,
 * so features degrade gracefully in development.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email skipped — RESEND_API_KEY not set] to=${to} subject="${subject}"`);
    return false;
  }
  try {
    const { error } = await new Resend(key).emails.send({ from: process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`, to, subject, text });
    if (error) console.error("sendEmail failed", error);
    return !error;
  } catch (e) {
    console.error("sendEmail failed", e);
    return false;
  }
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
