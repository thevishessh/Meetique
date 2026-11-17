/**
 * Branding + deployment mode. Everything here is controlled from `.env`,
 * so the same code can be delivered to different clients.
 */

/** The underlying product (shown as "Powered by …") */
export const PRODUCT_NAME = "Meetique";

/** Name shown in the logo / browser tab, e.g. "CU Unnao Appointments" */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || PRODUCT_NAME;
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || "Smart Scheduling. Instant Tokens. Organized Meetings.";
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Single-client mode. When set (e.g. "cu-unnao"), the home page opens this organization's
 * booking portal directly instead of the multi-organization landing page.
 */
export const CLIENT_ORG_SLUG = process.env.CLIENT_ORG_SLUG || null;

/**
 * PUBLIC_BOOKING=false → internal mode: only signed-in staff can book (booking uses their own
 * profile, no name/mobile form), the public portal and "find my booking" are closed.
 */
export const PUBLIC_BOOKING = process.env.PUBLIC_BOOKING !== "false";

/** Whether anyone may register a new organization at /register. Set ALLOW_ORG_SIGNUP=false for a single client. */
export const ALLOW_ORG_SIGNUP = process.env.ALLOW_ORG_SIGNUP !== "false";

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];
