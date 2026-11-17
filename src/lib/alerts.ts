import "server-only";
import { prisma } from "./db";
import { sendPush } from "./push";
import { sendEmail } from "./mailer";
import { fmtDate, fmtRange, localDateOf, todayIn } from "./time";
import { APP_NAME } from "./config";

type Alert = { title: string; body: string; url?: string; urgent?: boolean; email?: boolean; tag?: string };

/**
 * One place to tell a person something: saves it for the bell (in-app),
 * sends a phone/desktop push to all their devices, and optionally emails them.
 */
export async function alertUser(userId: string, a: Alert) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
    if (!user?.isActive) return;
    await prisma.userNotification.create({ data: { userId, title: a.title, body: a.body, url: a.url, urgent: !!a.urgent } });
    await sendPush(userId, { title: a.title, body: a.body, url: a.url, urgent: a.urgent, tag: a.tag });
    if (a.email) await sendEmail(user.email, `${a.title} — ${APP_NAME}`, `${a.body}\n\n${a.url ? `Open: ${process.env.APP_URL ?? ""}${a.url}` : ""}`);
  } catch (e) {
    console.error("alertUser failed", e);
  }
}

export type MeetingEvent = "BOOKED" | "APPROVED" | "DECLINED" | "CANCELLED" | "RESCHEDULED" | "SUMMONED" | "REMINDER";

/**
 * Meeting events → who gets told:
 *  BOOKED       → officer (new booking / approval needed)
 *  APPROVED / DECLINED → attendee
 *  CANCELLED / RESCHEDULED → the other side (not the person who did it)
 *  SUMMONED     → attendee (urgent)
 *  REMINDER     → attendee + officer, 15 minutes before
 */
export async function meetingEvent(appointmentId: string, event: MeetingEvent, actorUserId?: string | null) {
  try {
    const a = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        organization: { select: { timezone: true } },
        visitor: { select: { name: true, userId: true } },
        officer: { select: { userId: true, designation: true, location: true, user: { select: { name: true } } } },
        tokens: { where: { isActive: true }, take: 1, select: { tokenNumber: true } },
      },
    });
    if (!a) return;
    const tz = a.organization.timezone;
    const when = `${localDateOf(a.startAt, tz) === todayIn(tz) ? "Today" : fmtDate(a.startAt, tz)}, ${fmtRange(a.startAt, a.endAt, tz)}`;
    const officerName = a.officer.user.name;
    const attendee = a.visitor.userId;
    const officer = a.officer.userId;
    const purpose = a.purpose ? `\n“${a.purpose}”` : "";
    const where = a.officer.location ? ` · ${a.officer.location}` : "";
    const toAttendee = (x: Alert) => attendee && attendee !== actorUserId && alertUser(attendee, x);
    const toOfficer = (x: Alert) => officer !== actorUserId && alertUser(officer, x);

    switch (event) {
      case "BOOKED":
        await toOfficer({
          title: a.status === "PENDING" ? `Approval needed: ${a.visitor.name}` : `New meeting: ${a.visitor.name}`,
          body: `${when}${purpose}`,
          url: "/officer",
          email: true,
        });
        break;
      case "APPROVED":
        await toAttendee({ title: `Meeting approved by ${officerName}`, body: `${when}${where}`, url: "/me", email: true });
        break;
      case "DECLINED":
        await toAttendee({ title: `Meeting request declined by ${officerName}`, body: `${when}. You can book another time.`, url: "/me", email: true });
        break;
      case "CANCELLED":
        await toOfficer({ title: `Cancelled: ${a.visitor.name}`, body: `${when} — the attendee cancelled.`, url: "/officer" });
        await toAttendee({ title: `Meeting cancelled by ${officerName}`, body: `${when} has been cancelled.`, url: "/me", email: true });
        break;
      case "RESCHEDULED":
        await toOfficer({ title: `Rescheduled: ${a.visitor.name}`, body: `New time: ${when}`, url: "/officer" });
        await toAttendee({ title: `Meeting time changed`, body: `${officerName}: new time ${when}`, url: "/me", email: true });
        break;
      case "SUMMONED":
        if (attendee)
          await alertUser(attendee, {
            title: `URGENT: ${officerName} has called you`,
            body: `${when}${where}${purpose}`,
            url: "/me",
            urgent: true,
            email: true,
            tag: `summon-${a.id}`,
          });
        break;
      case "REMINDER":
        if (attendee) await alertUser(attendee, { title: `Meeting in 15 minutes`, body: `${officerName} — ${when}${where}`, url: "/me", tag: `rem-${a.id}` });
        await alertUser(officer, { title: `Next meeting in 15 minutes`, body: `${a.visitor.name} — ${when}`, url: "/officer", tag: `rem-${a.id}` });
        break;
    }
  } catch (e) {
    console.error("meetingEvent failed", e);
  }
}
