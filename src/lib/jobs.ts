import "server-only";
import { prisma } from "./db";
import { changeStatus } from "./booking";
import { meetingEvent } from "./alerts";

export const REMINDER_MIN = 15; // remind this many minutes before a meeting
export const NO_SHOW_GRACE_MIN = 30; // a BOOKED meeting with no check-in this long after its end → No Show

/**
 * Periodic housekeeping (runs every minute in the server, or via POST /api/cron/tick):
 *  1. 15-minute reminders to attendee + officer
 *  2. Booked meetings nobody checked in → No Show (slot/token released)
 *  3. Requests the officer never approved → Declined when their time passes
 *  4. Old notifications / used reset links cleaned up
 * Every step "claims" rows with a conditional update, so two servers can't double-send.
 */
export async function runJobs(now = new Date()) {
  const result = { reminders: 0, noShows: 0, expired: 0 };

  // 1. Reminders
  const soon = await prisma.appointment.findMany({
    where: { status: "BOOKED", reminderSentAt: null, startAt: { gt: now, lte: new Date(now.getTime() + REMINDER_MIN * 60_000) } },
    select: { id: true, createdAt: true, startAt: true },
  });
  for (const a of soon) {
    const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    // Booked only minutes ago? The booking alert already did the job.
    if (a.startAt.getTime() - a.createdAt.getTime() < REMINDER_MIN * 60_000) continue;
    await meetingEvent(a.id, "REMINDER");
    result.reminders++;
  }

  // 2. Auto no-show
  const missed = await prisma.appointment.findMany({
    where: { status: "BOOKED", endAt: { lt: new Date(now.getTime() - NO_SHOW_GRACE_MIN * 60_000) } },
    select: { id: true },
    take: 200,
  });
  for (const a of missed) {
    try {
      await changeStatus(a.id, "NO_SHOW", null, `Automatic: not checked in within ${NO_SHOW_GRACE_MIN} min after the meeting`);
      result.noShows++;
    } catch {
      /* status changed meanwhile — fine */
    }
  }

  // 3. Unanswered approval requests
  const stale = await prisma.appointment.findMany({ where: { status: "PENDING", startAt: { lt: now } }, select: { id: true }, take: 200 });
  for (const a of stale) {
    try {
      await changeStatus(a.id, "DECLINED", null, "Automatic: not approved before the meeting time");
      await meetingEvent(a.id, "DECLINED");
      result.expired++;
    } catch {
      /* already decided */
    }
  }

  // 4. Cleanup
  await prisma.userNotification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 60 * 864e5) } } });
  await prisma.passwordReset.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } });
  return result;
}

const g = globalThis as unknown as { __meetiqueJobs?: NodeJS.Timeout };

/** Starts the once-a-minute timer (only once per process, also across dev hot reloads) */
export function startJobs() {
  if (g.__meetiqueJobs) return;
  const tick = () => runJobs().catch((e) => console.error("[jobs] failed", e));
  g.__meetiqueJobs = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
  console.info("[jobs] reminders & auto no-show running every minute");
}
