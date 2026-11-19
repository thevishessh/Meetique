import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { rescheduleSchema } from "@/lib/validation";
import { rescheduleAppointment } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { safeEqual } from "@/lib/safe-equal";
import { meetingEvent } from "@/lib/alerts";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

/** Visitors authenticate with their manage code; staff with their session */
async function authorize(id: string, code: string | null | undefined) {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      visitor: true,
      tokens: { where: { isActive: true }, take: 1 },
      officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
      logs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!a) throw new AppError("NOT_FOUND", "Appointment not found", 404);
  if (safeEqual(code, a.manageCode)) return { a, actor: null };
  const user = await getUser();
  if (user && !user.mustChangePassword && user.organizationId === a.organizationId) {
    if (a.visitor.userId === user.id) return { a, actor: null }; // the attendee — same rights as the manage code
    if (user.role === "ADMIN" || user.role === "RECEPTIONIST" || (user.role === "OFFICER" && user.officerId === a.officerId)) return { a, actor: user };
  }
  throw new AppError("NOT_FOUND", "Appointment not found", 404);
}

export const GET = handle(async (req: NextRequest, { params }: Ctx) => {
  const { a } = await authorize((await params).id, req.nextUrl.searchParams.get("code"));
  const { manageCode: _omit, ...safe } = a;
  return ok(safe);
});

/** PATCH /api/appointments/:id — reschedule */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const body = rescheduleSchema.parse(await readJson(req));
  const { a, actor } = await authorize((await params).id, body.code);
  if (actor && actor.role === "RECEPTIONIST") return fail(403, "FORBIDDEN", "Receptionists cannot reschedule");
  const updated = await rescheduleAppointment(a.id, body.startAt, actor);
  void notifyAppointment(a.id, "RESCHEDULED");
  void meetingEvent(a.id, "RESCHEDULED", actor?.id ?? a.visitor.userId);
  return ok({ id: updated.id, startAt: updated.startAt, endAt: updated.endAt });
});
