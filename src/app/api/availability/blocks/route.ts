import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { blockSchema } from "@/lib/validation";
import { resolveOfficer } from "@/lib/scope";

/** Holidays, leave, breaks (UNAVAILABLE) or temporary availability overrides (AVAILABLE).
 *  startAt/endAt may be "yyyy-MM-ddTHH:mm" local times in the org timezone. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("ADMIN", "OFFICER");
  const d = blockSchema.parse(await readJson(req));
  const officer = await resolveOfficer(user, d.officerId);
  const tz = user.org.timezone;
  const s = DateTime.fromISO(d.startAt, { zone: tz });
  const e = DateTime.fromISO(d.endAt, { zone: tz });
  if (!s.isValid || !e.isValid || e <= s) return fail(422, "VALIDATION", "End must be after start");
  const block = await prisma.availabilityBlock.create({
    data: { officerId: officer.id, kind: d.kind, startAt: s.toJSDate(), endAt: e.toJSDate(), reason: d.reason || null },
  });
  return ok(block, 201);
});
