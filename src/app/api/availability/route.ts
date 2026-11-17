import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { workingHoursSchema } from "@/lib/validation";
import { resolveOfficer } from "@/lib/scope";
import { hmToMinutes } from "@/lib/time";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser("ADMIN", "OFFICER");
  const officer = await resolveOfficer(user, req.nextUrl.searchParams.get("officerId"));
  const [hours, blocks] = await Promise.all([
    prisma.workingHour.findMany({ where: { officerId: officer.id }, orderBy: { weekday: "asc" } }),
    prisma.availabilityBlock.findMany({ where: { officerId: officer.id, endAt: { gt: new Date() } }, orderBy: { startAt: "asc" } }),
  ]);
  return ok({ officer, hours, blocks });
});

/** POST /api/availability — replace weekly working hours (+ optional slot settings) */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("ADMIN", "OFFICER");
  const d = workingHoursSchema.parse(await readJson(req));
  const officer = await resolveOfficer(user, d.officerId);

  for (const day of d.days.filter((x) => x.enabled)) {
    const s = hmToMinutes(day.startTime), e = hmToMinutes(day.endTime);
    if (e <= s) return fail(422, "VALIDATION", `Day ${day.weekday}: end time must be after start time`);
    if (day.breakStart || day.breakEnd) {
      if (!day.breakStart || !day.breakEnd) return fail(422, "VALIDATION", `Day ${day.weekday}: set both break start and end`);
      const bs = hmToMinutes(day.breakStart), be = hmToMinutes(day.breakEnd);
      if (be <= bs || bs < s || be > e) return fail(422, "VALIDATION", `Day ${day.weekday}: break must be inside working hours`);
    }
  }

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { officerId: officer.id } }),
    prisma.workingHour.createMany({
      data: d.days
        .filter((x) => x.enabled)
        .map((x) => ({ officerId: officer.id, weekday: x.weekday, startTime: x.startTime, endTime: x.endTime, breakStart: x.breakStart || null, breakEnd: x.breakEnd || null })),
    }),
    ...(d.settings
      ? [prisma.officerProfile.update({ where: { id: officer.id }, data: { ...d.settings, maxPerDay: d.settings.maxPerDay ?? null, maxDurationMin: Math.max(d.settings.maxDurationMin, d.settings.slotDurationMin) } })]
      : []),
  ]);
  return ok({ ok: true });
});
