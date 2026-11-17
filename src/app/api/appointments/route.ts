import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { bookingSchema } from "@/lib/validation";
import { bookAppointment } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { AppError } from "@/lib/errors";
import { dayBounds, isValidDate, todayIn } from "@/lib/time";
import type { AppointmentStatus } from "@/generated/prisma/enums";

/** POST /api/appointments — public booking, or walk-in registration by staff */
export const POST = handle(async (req: Request) => {
  const d = bookingSchema.parse(await readJson(req));
  let actor = null;
  if (d.walkIn) {
    actor = await requireApiUser("ADMIN", "RECEPTIONIST", "OFFICER");
  }
  const { appointment, token } = await bookAppointment({
    officerId: d.officerId,
    startAt: d.startAt,
    name: d.name,
    phone: d.phone,
    email: d.email,
    purpose: d.purpose,
    source: d.walkIn ? "WALK_IN" : "ONLINE",
    actor,
  });
  void notifyAppointment(appointment.id, "BOOKED");
  return ok({ id: appointment.id, manageCode: appointment.manageCode, tokenNumber: token.tokenNumber, status: appointment.status }, 201);
});

/** GET /api/appointments?date=&officerId=&status= — staff listing (officers see only their own) */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser();
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") || todayIn(user.org.timezone);
  if (!isValidDate(date)) throw new AppError("VALIDATION", "date must be yyyy-MM-dd", 422);
  const { start, end } = dayBounds(date, user.org.timezone);
  const officerId = user.role === "OFFICER" ? user.officerId! : sp.get("officerId") || undefined;
  const status = (sp.get("status") || undefined) as AppointmentStatus | undefined;
  const rows = await prisma.appointment.findMany({
    where: { organizationId: user.organizationId, officerId, status, startAt: { gte: start, lt: end } },
    include: {
      visitor: true,
      tokens: { where: { isActive: true }, take: 1 },
      officer: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });
  return ok(rows);
});

export const dynamic = "force-dynamic";
