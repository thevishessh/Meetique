import { DateTime } from "luxon";
import type { SessionUser } from "./auth";

/** Meeting lengths an officer can pick for an immediate meeting */
export const SUMMON_DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

/** Parses "now" / local time and applies the limits for immediate meetings */
export function parseWhen(when: string, user: SessionUser): { start?: DateTime; error?: string } {
  const tz = user.org.timezone;
  if (when === "now") return { start: DateTime.now().setZone(tz).set({ second: 0, millisecond: 0 }) };
  const start = DateTime.fromISO(when, { zone: tz });
  if (!start.isValid) return { error: "Invalid time" };
  if (start < DateTime.now().minus({ minutes: 5 })) return { error: "That time has already passed" };
  if (start > DateTime.now().plus({ days: 7 })) return { error: "Immediate meetings can be set at most 7 days ahead — use normal booking for later" };
  return { start };
}
