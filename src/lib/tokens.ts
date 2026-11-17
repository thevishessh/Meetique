import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { APP_URL } from "./config";

/** Random, unguessable identifier. Contains no personal data. */
export function randomSecret(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

/** ORG-SHORTCODE-YEAR-SEQUENCE → e.g. ABC-2026-000124 */
export function formatTokenNumber(shortCode: string, year: number, seq: number): string {
  return `${shortCode.toUpperCase()}-${year}-${String(seq).padStart(6, "0")}`;
}

export function verifyUrl(qrSecret: string): string {
  return `${APP_URL}/t/${qrSecret}`;
}

export function manageUrl(manageCode: string): string {
  return `${APP_URL}/a/${manageCode}`;
}

export async function qrDataUrl(qrSecret: string): Promise<string> {
  return QRCode.toDataURL(verifyUrl(qrSecret), { margin: 1, width: 320, errorCorrectionLevel: "M" });
}

/** Accepts a scanned verification URL, a raw QR secret, or a token number */
export function parseScan(input: string): { qrSecret?: string; tokenNumber?: string } {
  const v = input.trim();
  const m = v.match(/\/t\/([A-Za-z0-9_-]+)\/?$/);
  if (m) return { qrSecret: m[1] };
  if (/^[A-Za-z0-9]+-\d{4}-\d{1,}$/.test(v)) return { tokenNumber: v.toUpperCase() };
  return { qrSecret: v };
}
