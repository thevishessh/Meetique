import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { holidaySchema } from "@/lib/validation";

export const GET = handle(async () => {
  const user = await requireApiUser();
  return ok(await prisma.orgHoliday.findMany({ where: { organizationId: user.organizationId }, orderBy: { date: "asc" } }));
});

/** POST /api/holidays { date, endDate?, name } — one row per day in the range */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("ADMIN");
  const d = holidaySchema.parse(await readJson(req));
  const start = DateTime.fromISO(d.date);
  const end = DateTime.fromISO(d.endDate || d.date);
  if (end < start) return fail(422, "VALIDATION", "End date must be on or after start date");
  const days = Math.round(end.diff(start, "days").days) + 1;
  if (days > 60) return fail(422, "VALIDATION", "A holiday range can be at most 60 days");
  const res = await prisma.orgHoliday.createMany({
    data: Array.from({ length: days }, (_, i) => ({ organizationId: user.organizationId, date: start.plus({ days: i }).toFormat("yyyy-MM-dd"), name: d.name })),
    skipDuplicates: true,
  });
  return ok({ created: res.count }, 201);
});
