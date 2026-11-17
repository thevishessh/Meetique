import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { getDaySlots } from "@/lib/slots";
import { isValidDate } from "@/lib/time";

/** GET /api/slots?officerId=&date=yyyy-MM-dd[&duration=30][&staff=1][&ignore=<appointmentId>] */
export const GET = handle(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const officerId = sp.get("officerId") ?? "";
  const date = sp.get("date") ?? "";
  if (!isValidDate(date)) return fail(422, "VALIDATION", "date must be yyyy-MM-dd");
  const officer = await prisma.officerProfile.findUnique({ where: { id: officerId } });
  if (!officer) return fail(404, "NOT_FOUND", "Officer not found");

  let staffOverride = false;
  if (sp.get("staff") === "1") {
    const u = await getUser();
    staffOverride = !!u && u.organizationId === officer.organizationId;
  }
  const durationMin = Number(sp.get("duration")) || undefined;
  const day = await getDaySlots(officerId, date, { staffOverride, ignoreAppointmentId: sp.get("ignore") ?? undefined, durationMin });
  return ok(day);
});
