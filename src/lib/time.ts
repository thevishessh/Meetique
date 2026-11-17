import { DateTime } from "luxon";

export const DATE_FMT = "yyyy-MM-dd";

/** "HH:mm" → minutes after midnight */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function isValidHM(hm: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hm);
}

/** A wall-clock time on a given local date in a timezone → DateTime */
export function atLocal(date: string, hm: string, tz: string): DateTime {
  const mins = hmToMinutes(hm);
  return DateTime.fromISO(date, { zone: tz }).startOf("day").plus({ minutes: mins });
}

export function todayIn(tz: string): string {
  return DateTime.now().setZone(tz).toFormat(DATE_FMT);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && DateTime.fromISO(date).isValid;
}

export function fmtDate(d: Date | string, tz: string): string {
  return toDT(d, tz).toFormat("ccc, d LLL yyyy");
}

export function fmtLongDate(d: Date | string, tz: string): string {
  return toDT(d, tz).toFormat("cccc, d LLLL yyyy");
}

export function fmtTime(d: Date | string, tz: string): string {
  return toDT(d, tz).toFormat("h:mm a");
}

export function fmtRange(start: Date | string, end: Date | string, tz: string): string {
  return `${fmtTime(start, tz)} – ${fmtTime(end, tz)}`;
}

export function fmtDateTime(d: Date | string, tz: string): string {
  return toDT(d, tz).toFormat("d LLL yyyy, h:mm a");
}

export function localDateOf(d: Date | string, tz: string): string {
  return toDT(d, tz).toFormat(DATE_FMT);
}

function toDT(d: Date | string, tz: string): DateTime {
  return (typeof d === "string" ? DateTime.fromISO(d) : DateTime.fromJSDate(d)).setZone(tz);
}

/** UTC bounds of a local calendar day */
export function dayBounds(date: string, tz: string): { start: Date; end: Date } {
  const s = DateTime.fromISO(date, { zone: tz }).startOf("day");
  return { start: s.toJSDate(), end: s.plus({ days: 1 }).toJSDate() };
}
