import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { statusSchema } from "@/lib/validation";
import { changeStatus } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { meetingEvent } from "@/lib/alerts";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const d = statusSchema.parse(await readJson(req));
  const id = (await params).id;
  const before = d.status;
  const a = await changeStatus(id, d.status, user, d.note);
  if (before === "CANCELLED") {
    void notifyAppointment(id, "CANCELLED");
    void meetingEvent(id, "CANCELLED", user.id);
  }
  if (before === "BOOKED") void meetingEvent(id, "APPROVED", user.id);
  if (before === "DECLINED") void meetingEvent(id, "DECLINED", user.id);
  return ok({ id: a.id, status: a.status });
});
