import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canUseReception, getUser, receptionScope, requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { bookingSchema } from "@/lib/validation";
import { bookAppointment } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { meetingEvent } from "@/lib/alerts";
import { AppError } from "@/lib/errors";
import { PUBLIC_BOOKING } from "@/lib/config";
import { dayBounds, isValidDate, todayIn } from "@/lib/time";
import type { AppointmentStatus } from "@/generated/prisma/enums";

/** POST /api/appointments — staff booking (internal), public booking, or walk-in registration by reception */
export const POST = handle(async (req: Request) => {
  const d = bookingSchema.parse(await readJson(req));
  let actor = null;
  let attendeeUserId: string | null = null;
  let referenceNo: string | null = null;

  if (d.walkIn) {
    // Walk-in registered at reception: name + mobile + L Code from the form
    actor = await requireApiUser();
    if (!canUseReception(actor) && actor.role !== "OFFICER") throw new AppError("FORBIDDEN", "You do not have access to the reception desk", 403);
    if (actor.role === "OFFICER" && d.officerId !== actor.officerId) throw new AppError("FORBIDDEN", "Officers can register walk-ins only for their own queue", 403);
    if (actor.role === "STAFF" && d.officerId !== receptionScope(actor)) throw new AppError("FORBIDDEN", `As PA you can register walk-ins only for ${actor.pa?.officerName}`, 403);
    if (!d.name || !d.phone) throw new AppError("VALIDATION", "Name and mobile number are required", 422);
    if (!d.lCode) throw new AppError("VALIDATION", "L Code is required", 422);
    const staff = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, employeeId: d.lCode, isActive: true } });
    if (staff) attendeeUserId = staff.id; // link to the staff member's account
    else referenceNo = d.lCode;
  } else if (!PUBLIC_BOOKING) {
    // Internal mode: the signed-in staff member books for themself
    const me = await getUser();
    if (!me) throw new AppError("UNAUTHORIZED", "Please sign in to book a meeting", 401);
    if (me.mustChangePassword) throw new AppError("PASSWORD_CHANGE_REQUIRED", "Please set a new password first", 403);
    if (me.role === "RECEPTIONIST") throw new AppError("FORBIDDEN", "Use walk-in registration on the reception desk", 403);
    if (me.officerId === d.officerId) throw new AppError("VALIDATION", "You cannot book a meeting with yourself", 422);
    if (!me.employeeId) {
      // L Code is compulsory: collect it once and save it on the profile
      if (!d.lCode) throw new AppError("L_CODE_REQUIRED", "Please enter your L Code", 422);
      const taken = await prisma.user.findFirst({ where: { organizationId: me.organizationId, employeeId: d.lCode, NOT: { id: me.id } } });
      if (taken) throw new AppError("L_CODE_TAKEN", "This L Code belongs to another account — contact the IT admin", 409);
      await prisma.user.update({ where: { id: me.id }, data: { employeeId: d.lCode } });
    }
    attendeeUserId = me.id;
  } else if (!d.name || !d.phone) {
    throw new AppError("VALIDATION", "Name and mobile number are required", 422);
  }

  const { appointment, token } = await bookAppointment({
    officerId: d.officerId,
    startAt: d.startAt,
    durationMin: d.durationMin,
    name: d.name ?? "",
    phone: d.phone,
    email: d.email,
    attendeeUserId,
    purpose: d.purpose,
    visitorCategory: d.visitorCategory,
    referenceNo: referenceNo ?? d.referenceNo,
    source: d.walkIn ? "WALK_IN" : "ONLINE",
    actor,
  });
  if (!d.walkIn) {
    void notifyAppointment(appointment.id, "BOOKED");
    void meetingEvent(appointment.id, "BOOKED", attendeeUserId);
  }
  return ok({ id: appointment.id, manageCode: appointment.manageCode, tokenNumber: token.tokenNumber, status: appointment.status }, 201);
});

/** GET /api/appointments?date=&officerId=&status= — staff listing (officers see only their own) */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser("ADMIN", "OFFICER", "RECEPTIONIST");
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
