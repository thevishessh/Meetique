import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { findConflicts } from "@/lib/booking";
import { parseWhen } from "@/lib/summon";

/** GET /api/summons/conflicts?ids=a,b&when=now|yyyy-MM-ddTHH:mm&duration=30 — who is already busy then */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser("OFFICER");
  if (!user.canSummon) return fail(403, "FORBIDDEN", "Not allowed");
  const sp = req.nextUrl.searchParams;
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 30);
  const w = parseWhen(sp.get("when") ?? "now", user);
  if (!w.start) return ok({ busy: [] });
  const dur = Math.min(Math.max(Number(sp.get("duration")) || 15, 5), 240);
  const start = w.start.toJSDate();
  const end = new Date(start.getTime() + dur * 60_000);
  return ok({ busy: await findConflicts(user.organizationId, ids, start, end, user.org.timezone) });
});
