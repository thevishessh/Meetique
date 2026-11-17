import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { saveNotes } from "@/lib/booking";

/** PUT /api/appointments/:id/notes { notes } — meeting notes / outcome (officer of the meeting, or admin) */
export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("OFFICER", "ADMIN");
  const { notes } = z.object({ notes: z.string().max(4000) }).parse(await readJson(req));
  const a = await saveNotes((await params).id, user, notes);
  return ok({ id: a.id, notes: a.notes });
});
