import { DateTime } from "luxon";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { summonMeeting } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";

const schema = z.object({
  targetUserId: z.string().min(1, "Choose who to call"),
  /** "now", or a local "yyyy-MM-ddTHH:mm" in the organization timezone */
  when: z.string().min(1),
  durationMin: z.coerce.number().int().refine((v) => [10, 15, 20, 30, 45, 60, 90, 120].includes(v), "Pick a duration"),
  purpose: z.string().trim().min(2, "Write the purpose of the meeting").max(300),
});

/** POST /api/summons — designated officer calls anyone in for an immediate meeting */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("OFFICER");
  if (!user.canSummon) return fail(403, "FORBIDDEN", "You are not designated to call immediate meetings");
  const d = schema.parse(await readJson(req));
  const tz = user.org.timezone;
  let start: DateTime;
  if (d.when === "now") {
    start = DateTime.now().setZone(tz).set({ second: 0, millisecond: 0 });
  } else {
    start = DateTime.fromISO(d.when, { zone: tz });
    if (!start.isValid) return fail(422, "VALIDATION", "Invalid time");
    if (start < DateTime.now().minus({ minutes: 5 })) return fail(422, "VALIDATION", "That time has already passed");
    if (start > DateTime.now().plus({ days: 7 })) return fail(422, "VALIDATION", "Immediate meetings can be set at most 7 days ahead — use normal booking for later");
  }
  const target = await prisma.user.findFirst({ where: { id: d.targetUserId, organizationId: user.organizationId, isActive: true } });
  if (!target) return fail(404, "NOT_FOUND", "That person was not found");
  const r = await summonMeeting({ actor: user, targetUserId: target.id, startAt: start.toJSDate(), durationMin: d.durationMin, purpose: d.purpose });
  void notifyAppointment(r.appointment.id, "BOOKED");
  return ok({ id: r.appointment.id, tokenNumber: r.token.tokenNumber, overlaps: r.overlaps, attendee: target.name }, 201);
});
