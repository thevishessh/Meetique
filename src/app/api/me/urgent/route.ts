import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { fmtRange, fmtDate, localDateOf, todayIn } from "@/lib/time";

/** Immediate meetings this user has been called into that are still pending (not started / finished) */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const tz = user.org.timezone;
  const rows = await prisma.appointment.findMany({
    where: { kind: "IMMEDIATE", status: { in: ["BOOKED", "CHECKED_IN", "WAITING"] }, visitor: { userId: user.id }, endAt: { gt: new Date(Date.now() - 2 * 3600_000) } },
    include: { officer: { include: { user: { select: { name: true } } } } },
    orderBy: { startAt: "asc" },
  });
  return ok(
    rows.map((a) => ({
      id: a.id,
      officer: a.officer.user.name,
      designation: a.officer.designation,
      location: a.officer.location,
      when: (localDateOf(a.startAt, tz) === todayIn(tz) ? "Today " : `${fmtDate(a.startAt, tz)} `) + fmtRange(a.startAt, a.endAt, tz),
      purpose: a.purpose,
      response: a.attendeeResponse,
      status: a.status,
    })),
  );
});
