import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { ACTIVE_STATUSES } from "./status";
import { atLocal, DATE_FMT, fmtTime } from "./time";

type Db = Prisma.TransactionClient | typeof prisma;

export type SlotReason = "PAST" | "NOTICE" | "SAME_DAY" | "FULL" | "DAY_LIMIT" | "NOT_BOOKABLE";

export type Slot = {
  start: string; // ISO (UTC)
  end: string;
  label: string; // "10:00 AM"
  booked: number;
  capacity: number;
  available: boolean;
  reason?: SlotReason;
};

export type DaySlots = {
  date: string;
  timezone: string;
  status: "OPEN" | "OFF" | "BLOCKED" | "OUT_OF_RANGE" | "NOT_BOOKABLE";
  message?: string;
  breaks: { start: string; end: string; label: string }[];
  slots: Slot[];
};

export type SlotOptions = {
  now?: Date;
  /** Skip the visitor-facing booking rules (notice, same-day, advance limit) — used for walk-ins by staff */
  staffOverride?: boolean;
  /** Don't count this appointment (used when rescheduling it) */
  ignoreAppointmentId?: string;
};

type Window = { start: DateTime; end: DateTime };

/**
 * Availability → slots. Availability (weekly hours + overrides + blocks) is turned into
 * concrete slots here; appointments only *reserve* those slots.
 */
export async function getDaySlots(officerId: string, date: string, opts: SlotOptions = {}, db: Db = prisma): Promise<DaySlots> {
  const officer = await db.officerProfile.findUnique({
    where: { id: officerId },
    include: { user: { select: { isActive: true, organization: { select: { timezone: true } } } } },
  });
  if (!officer) throw new Error("Officer not found");

  const tz = officer.user.organization.timezone;
  const now = DateTime.fromJSDate(opts.now ?? new Date()).setZone(tz);
  const day = DateTime.fromISO(date, { zone: tz }).startOf("day");
  const dayEnd = day.plus({ days: 1 });
  const base: DaySlots = { date, timezone: tz, status: "OPEN", breaks: [], slots: [] };

  if (!officer.isBookable || !officer.user.isActive) {
    if (!opts.staffOverride) return { ...base, status: "NOT_BOOKABLE", message: "This officer is not accepting appointments right now." };
  }

  const today = now.startOf("day");
  if (day < today) return { ...base, status: "OUT_OF_RANGE", message: "This date is in the past." };
  if (!opts.staffOverride) {
    const lastDay = today.plus({ days: officer.advanceBookingDays });
    if (day > lastDay) return { ...base, status: "OUT_OF_RANGE", message: `Bookings open only ${officer.advanceBookingDays} days in advance.` };
  }

  // 0. Organization-wide holiday (e.g. Diwali) closes online booking for every officer
  if (!opts.staffOverride) {
    const holiday = await db.orgHoliday.findUnique({ where: { organizationId_date: { organizationId: officer.organizationId, date } } });
    if (holiday) return { ...base, status: "BLOCKED", message: `Holiday: ${holiday.name}` };
  }

  // 1. Working windows for the day
  const [hours, blocks] = await Promise.all([
    db.workingHour.findUnique({ where: { officerId_weekday: { officerId, weekday: day.weekday } } }),
    db.availabilityBlock.findMany({
      where: { officerId, startAt: { lt: dayEnd.toJSDate() }, endAt: { gt: day.toJSDate() } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  let windows: Window[] = [];
  const overrides = blocks.filter((b) => b.kind === "AVAILABLE");
  if (overrides.length) {
    // Temporary availability override replaces the weekly hours for this day
    windows = overrides.map((b) => ({
      start: DateTime.max(DateTime.fromJSDate(b.startAt).setZone(tz), day),
      end: DateTime.min(DateTime.fromJSDate(b.endAt).setZone(tz), dayEnd),
    }));
  } else if (hours) {
    const s = atLocal(date, hours.startTime, tz);
    const e = atLocal(date, hours.endTime, tz);
    if (hours.breakStart && hours.breakEnd) {
      const bs = atLocal(date, hours.breakStart, tz);
      const be = atLocal(date, hours.breakEnd, tz);
      windows = [
        { start: s, end: DateTime.min(bs, e) },
        { start: DateTime.max(be, s), end: e },
      ].filter((w) => w.end > w.start);
      base.breaks.push({ start: bs.toUTC().toISO()!, end: be.toUTC().toISO()!, label: `${bs.toFormat("h:mm a")} – ${be.toFormat("h:mm a")}` });
    } else {
      windows = [{ start: s, end: e }];
    }
  }

  if (!windows.length) return { ...base, status: "OFF", message: "The officer is not available on this day." };

  // 2. Generate slots: duration + buffer
  const unavailable = blocks
    .filter((b) => b.kind === "UNAVAILABLE")
    .map((b) => ({ start: DateTime.fromJSDate(b.startAt), end: DateTime.fromJSDate(b.endAt), reason: b.reason }));

  const dur = officer.slotDurationMin;
  const step = officer.slotDurationMin + officer.bufferMin;
  const raw: Window[] = [];
  for (const w of windows) {
    for (let c = w.start; c.plus({ minutes: dur }) <= w.end; c = c.plus({ minutes: step })) {
      const slot = { start: c, end: c.plus({ minutes: dur }) };
      if (unavailable.some((u) => slot.start < u.end && slot.end > u.start)) continue;
      raw.push(slot);
    }
  }

  if (!raw.length) {
    const fullDay = unavailable.find((u) => u.start <= windows[0].start && u.end >= windows[windows.length - 1].end);
    return { ...base, status: "BLOCKED", message: fullDay?.reason ? `Not available: ${fullDay.reason}` : "No slots available on this day." };
  }

  // 3. Count active appointments
  const appts = await db.appointment.findMany({
    where: {
      officerId,
      status: { in: ACTIVE_STATUSES },
      startAt: { lt: dayEnd.toJSDate() },
      endAt: { gt: day.toJSDate() },
      ...(opts.ignoreAppointmentId ? { id: { not: opts.ignoreAppointmentId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });
  const dayCount = appts.length;
  const dayLimitHit = officer.maxPerDay != null && dayCount >= officer.maxPerDay;
  const minStart = opts.staffOverride ? now : now.plus({ minutes: officer.minNoticeMin });
  const isToday = day.hasSame(now, "day");

  base.slots = raw.map(({ start, end }) => {
    const booked = appts.filter((a) => a.startAt < end.toJSDate() && a.endAt > start.toJSDate()).length;
    let reason: SlotReason | undefined;
    if (opts.staffOverride ? end <= now : start < now) reason = "PAST";
    else if (!opts.staffOverride && isToday && !officer.allowSameDay) reason = "SAME_DAY";
    else if (!opts.staffOverride && start < minStart) reason = "NOTICE";
    else if (booked >= officer.capacityPerSlot) reason = "FULL";
    else if (dayLimitHit && !opts.staffOverride) reason = "DAY_LIMIT";
    return {
      start: start.toUTC().toISO()!,
      end: end.toUTC().toISO()!,
      label: fmtTime(start.toJSDate(), tz),
      booked,
      capacity: officer.capacityPerSlot,
      available: !reason,
      reason,
    };
  });

  if (!isToday || base.slots.some((s) => s.available)) return base;
  if (!officer.allowSameDay && !opts.staffOverride) base.message = "Same-day booking is disabled for this officer.";
  return base;
}

/** Next N days that have at least one open slot (for the visitor date picker) */
export async function getOpenDays(officerId: string, from: string, days: number): Promise<{ date: string; open: number }[]> {
  const out: { date: string; open: number }[] = [];
  const start = DateTime.fromISO(from);
  for (let i = 0; i < days; i++) {
    const date = start.plus({ days: i }).toFormat(DATE_FMT);
    const d = await getDaySlots(officerId, date);
    out.push({ date, open: d.slots.filter((s) => s.available).length });
  }
  return out;
}
