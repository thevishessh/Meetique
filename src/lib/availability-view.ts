import { prisma } from "./db";
import { fmtDateTime, fmtDate, fmtTime } from "./time";
import type { BlockView, Settings, Hours } from "@/components/availability-editor";

export async function loadAvailability(officerId: string, tz: string) {
  const o = await prisma.officerProfile.findUniqueOrThrow({
    where: { id: officerId },
    include: {
      workingHours: true,
      blocks: { where: { endAt: { gt: new Date() } }, orderBy: { startAt: "asc" } },
      user: { select: { name: true, email: true, phone: true, isActive: true } },
      department: true,
    },
  });
  const hours: Hours[] = o.workingHours.map(({ weekday, startTime, endTime, breakStart, breakEnd }) => ({ weekday, startTime, endTime, breakStart, breakEnd }));
  const settings: Settings = {
    slotDurationMin: o.slotDurationMin,
    bufferMin: o.bufferMin,
    capacityPerSlot: o.capacityPerSlot,
    maxPerDay: o.maxPerDay,
    advanceBookingDays: o.advanceBookingDays,
    minNoticeMin: o.minNoticeMin,
    allowSameDay: o.allowSameDay,
    isBookable: o.isBookable,
  };
  const blocks: BlockView[] = o.blocks.map((b) => {
    const fullDay = fmtTime(b.startAt, tz) === "12:00 AM" && fmtTime(b.endAt, tz) === "11:59 PM";
    const sameDay = fmtDate(b.startAt, tz) === fmtDate(b.endAt, tz);
    const label = fullDay
      ? sameDay ? `${fmtDate(b.startAt, tz)} (full day)` : `${fmtDate(b.startAt, tz)} → ${fmtDate(b.endAt, tz)}`
      : sameDay ? `${fmtDate(b.startAt, tz)}, ${fmtTime(b.startAt, tz)} – ${fmtTime(b.endAt, tz)}` : `${fmtDateTime(b.startAt, tz)} → ${fmtDateTime(b.endAt, tz)}`;
    return { id: b.id, kind: b.kind, label, reason: b.reason };
  });
  return { officer: o, hours, settings, blocks };
}
