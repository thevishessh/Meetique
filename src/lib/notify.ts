import { Resend } from "resend";
import { prisma } from "./db";
import { APP_NAME } from "./config";
import { fmtLongDate, fmtRange } from "./time";
import { manageUrl, verifyUrl } from "./tokens";

type Kind = "BOOKED" | "CANCELLED" | "RESCHEDULED";

const SUBJECT: Record<Kind, string> = {
  BOOKED: "Appointment confirmed",
  CANCELLED: "Appointment cancelled",
  RESCHEDULED: "Appointment rescheduled",
};

/**
 * Sends an email notification (best effort, after the booking transaction has committed)
 * and records the attempt in the notifications table. Without RESEND_API_KEY the attempt
 * is recorded as SKIPPED so the rest of the flow still works in development.
 */
export async function notifyAppointment(appointmentId: string, kind: Kind) {
  try {
    const a = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        visitor: true,
        organization: true,
        officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        tokens: { where: { isActive: true }, take: 1 },
      },
    });
    if (!a) return;
    const tz = a.organization.timezone;
    const token = a.tokens[0];

    if (!a.visitor.email) {
      await prisma.notification.create({
        data: { appointmentId, channel: "EMAIL", type: kind, recipient: "-", status: "SKIPPED", error: "Visitor has no email" },
      });
      return;
    }

    const n = await prisma.notification.create({
      data: { appointmentId, channel: "EMAIL", type: kind, recipient: a.visitor.email },
    });

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      await prisma.notification.update({ where: { id: n.id }, data: { status: "SKIPPED", error: "RESEND_API_KEY not configured" } });
      return;
    }

    const lines = [
      `Hello ${a.visitor.name},`,
      "",
      `${SUBJECT[kind]} — ${a.organization.name}`,
      `Officer: ${a.officer.user.name} (${a.officer.designation})${a.officer.department ? `, ${a.officer.department.name}` : ""}`,
      `Date: ${fmtLongDate(a.startAt, tz)}`,
      `Time: ${fmtRange(a.startAt, a.endAt, tz)}`,
      token ? `Token: ${token.tokenNumber}` : "",
      "",
      kind !== "CANCELLED" && token ? `Show this QR at reception: ${verifyUrl(token.qrSecret)}` : "",
      `View / reschedule / cancel: ${manageUrl(a.manageCode)}`,
      "",
      `— ${APP_NAME}`,
    ].filter((l) => l !== undefined);

    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`,
      to: a.visitor.email,
      subject: `${SUBJECT[kind]}${token ? ` · ${token.tokenNumber}` : ""}`,
      text: lines.join("\n"),
    });
    await prisma.notification.update({
      where: { id: n.id },
      data: error ? { status: "FAILED", error: error.message } : { status: "SENT", sentAt: new Date() },
    });
  } catch (e) {
    console.error("notifyAppointment failed", e);
  }
}
