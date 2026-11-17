import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { changeStatus } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";

/** POST /api/appointments/:id/cancel  body: { code? , note? } */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = (await params).id;
  const body = (await readJson(req).catch(() => ({}))) as { code?: string; note?: string };
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a) return fail(404, "NOT_FOUND", "Appointment not found");

  if (body.code && body.code === a.manageCode) {
    if (a.status !== "BOOKED") return fail(409, "NOT_ALLOWED", "Only upcoming booked appointments can be cancelled");
    if (a.startAt <= new Date()) return fail(409, "NOT_ALLOWED", "This appointment time has already passed");
    await changeStatus(id, "CANCELLED", null, body.note || "Cancelled by visitor");
  } else {
    const user = await getUser();
    if (!user) return fail(404, "NOT_FOUND", "Appointment not found");
    await changeStatus(id, "CANCELLED", user, body.note);
  }
  void notifyAppointment(id, "CANCELLED");
  return ok({ ok: true });
});
