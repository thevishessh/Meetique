import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { statusSchema } from "@/lib/validation";
import { changeStatus } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const d = statusSchema.parse(await readJson(req));
  const id = (await params).id;
  const a = await changeStatus(id, d.status, user, d.note);
  if (d.status === "CANCELLED") void notifyAppointment(id, "CANCELLED");
  return ok({ id: a.id, status: a.status });
});
