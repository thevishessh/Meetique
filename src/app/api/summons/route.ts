import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { summonMeeting } from "@/lib/booking";
import { meetingEvent } from "@/lib/alerts";
import { SUMMON_DURATIONS, parseWhen } from "@/lib/summon";

const schema = z.object({
  targetUserIds: z.array(z.string().min(1)).min(1, "Choose who to call").max(30, "At most 30 people at once"),
  /** "now", or a local "yyyy-MM-ddTHH:mm" in the organization timezone */
  when: z.string().min(1),
  durationMin: z.coerce.number().int().refine((v) => SUMMON_DURATIONS.includes(v), "Pick a duration"),
  purpose: z.string().trim().min(2, "Write the purpose of the meeting").max(300),
});

/** POST /api/summons — designated officer calls one or more people in for an immediate meeting */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser("OFFICER");
  if (!user.canSummon) return fail(403, "FORBIDDEN", "You are not designated to call immediate meetings");
  const d = schema.parse(await readJson(req));
  const w = parseWhen(d.when, user);
  if (!w.start) return fail(422, "VALIDATION", w.error!);
  const found = await prisma.user.count({ where: { id: { in: d.targetUserIds }, organizationId: user.organizationId, isActive: true } });
  if (found !== new Set(d.targetUserIds).size) return fail(404, "NOT_FOUND", "One or more people were not found");

  const r = await summonMeeting({ actor: user, targetUserIds: d.targetUserIds, startAt: w.start.toJSDate(), durationMin: d.durationMin, purpose: d.purpose });
  for (const c of r.created) void meetingEvent(c.appointmentId, "SUMMONED", user.id);
  const names = await prisma.user.findMany({ where: { id: { in: r.created.map((c) => c.userId) } }, select: { name: true } });
  return ok({ created: r.created.length, tokens: r.created.map((c) => c.tokenNumber), attendees: names.map((n) => n.name), overlaps: r.overlaps, groupId: r.groupId }, 201);
});
