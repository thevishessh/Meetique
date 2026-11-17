import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { respondToMeeting } from "@/lib/booking";

const schema = z.object({ response: z.enum(["ACKNOWLEDGED", "ON_MY_WAY"]) });

/** POST /api/appointments/:id/respond { response } — the called person replies to an immediate meeting */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { response } = schema.parse(await readJson(req));
  const a = await respondToMeeting((await params).id, user, response);
  return ok({ id: a.id, attendeeResponse: a.attendeeResponse });
});
