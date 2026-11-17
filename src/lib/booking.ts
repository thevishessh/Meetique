import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus, AppointmentSource } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { AppError, isExclusionViolation } from "./errors";
import { getDaySlots } from "./slots";
import { ACTIVE_STATUSES, ROLE_CAN_SET, TRANSITIONS, STATUS_LABEL } from "./status";
import { formatTokenNumber, randomSecret } from "./tokens";
import { localDateOf } from "./time";
import type { SessionUser } from "./auth";

type Tx = Prisma.TransactionClient;

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 } as const;

/** Serialize all booking writes for one officer (row lock held until commit) */
async function lockOfficer(tx: Tx, officerId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM officer_profiles WHERE id = ${officerId} FOR UPDATE`;
  if (!rows.length) throw new AppError("NOT_FOUND", "Officer not found", 404);
}

/** Validates that `startAt` is a real, currently available slot, and picks a free seat */
async function claimSlot(tx: Tx, officerId: string, startAt: string, opts: { staffOverride?: boolean; ignoreAppointmentId?: string }) {
  const officer = await tx.officerProfile.findUniqueOrThrow({
    where: { id: officerId },
    include: { user: { select: { organization: { select: { timezone: true } } } } },
  });
  const tz = officer.user.organization.timezone;
  const start = DateTime.fromISO(startAt);
  if (!start.isValid) throw new AppError("BAD_SLOT", "Invalid slot time", 422);
  const date = localDateOf(start.toJSDate(), tz);

  const day = await getDaySlots(officerId, date, opts, tx);
  const slot = day.slots.find((s) => DateTime.fromISO(s.start).toMillis() === start.toMillis());
  if (!slot) throw new AppError("BAD_SLOT", day.message ?? "That time is not a valid slot for this officer", 422);
  if (!slot.available) {
    const msg: Record<string, string> = {
      FULL: "Sorry, this slot was just booked by someone else. Please pick another slot.",
      PAST: "This slot has already passed.",
      NOTICE: `Bookings need at least ${officer.minNoticeMin} minutes notice.`,
      SAME_DAY: "Same-day booking is not allowed for this officer.",
      DAY_LIMIT: "The officer's daily booking limit has been reached.",
    };
    throw new AppError("SLOT_UNAVAILABLE", msg[slot.reason ?? "FULL"] ?? "Slot unavailable", 409);
  }

  const s = new Date(slot.start);
  const e = new Date(slot.end);
  const used = await tx.appointment.findMany({
    where: {
      officerId,
      status: { in: ACTIVE_STATUSES },
      startAt: { lt: e },
      endAt: { gt: s },
      ...(opts.ignoreAppointmentId ? { id: { not: opts.ignoreAppointmentId } } : {}),
    },
    select: { seatNo: true },
  });
  const taken = new Set(used.map((u) => u.seatNo));
  let seatNo = 1;
  while (taken.has(seatNo)) seatNo++;
  if (seatNo > officer.capacityPerSlot) throw new AppError("SLOT_UNAVAILABLE", "Sorry, this slot is full.", 409);
  return { startAt: s, endAt: e, seatNo, officer };
}

async function nextTokenNumber(tx: Tx, orgId: string, shortCode: string, tz: string) {
  const year = DateTime.now().setZone(tz).year;
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO token_counters (organization_id, year, last_value) VALUES (${orgId}, ${year}, 1)
    ON CONFLICT (organization_id, year) DO UPDATE SET last_value = token_counters.last_value + 1
    RETURNING last_value`;
  return formatTokenNumber(shortCode, year, Number(rows[0].last_value));
}

export type BookingInput = {
  officerId: string;
  startAt: string;
  name: string;
  phone: string;
  email?: string | null;
  purpose?: string | null;
  source?: AppointmentSource;
  actor?: SessionUser | null;
};

/**
 * Atomic booking:
 *  1. transaction starts, officer row locked (concurrent bookings for this officer queue up)
 *  2. slot re-validated on the server + free seat chosen
 *  3. visitor upserted, appointment created
 *  4. token number from per-org/year counter, random QR secret
 *  5. audit log, commit — the exclusion constraint is the final guard
 */
export async function bookAppointment(input: BookingInput) {
  const walkIn = input.source === "WALK_IN";
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOfficer(tx, input.officerId);
      const { startAt, endAt, seatNo, officer } = await claimSlot(tx, input.officerId, input.startAt, { staffOverride: walkIn });
      const org = await tx.organization.findUniqueOrThrow({ where: { id: officer.organizationId } });
      if (input.actor && input.actor.organizationId !== org.id) throw new AppError("FORBIDDEN", "Wrong organization", 403);

      const phone = input.phone.replace(/[^\d+]/g, "");
      const visitor = await tx.visitor.upsert({
        where: { organizationId_phone: { organizationId: org.id, phone } },
        create: { organizationId: org.id, name: input.name, phone, email: input.email || null },
        update: { name: input.name, ...(input.email ? { email: input.email } : {}) },
      });

      const status: AppointmentStatus = walkIn ? "CHECKED_IN" : "BOOKED";
      const appt = await tx.appointment.create({
        data: {
          organizationId: org.id,
          visitorId: visitor.id,
          officerId: officer.id,
          startAt,
          endAt,
          seatNo,
          status,
          source: input.source ?? "ONLINE",
          purpose: input.purpose || null,
          manageCode: randomSecret(24),
          checkedInAt: walkIn ? new Date() : null,
        },
      });

      const tokenNumber = await nextTokenNumber(tx, org.id, org.shortCode, org.timezone);
      const token = await tx.token.create({
        data: { appointmentId: appt.id, tokenNumber, qrSecret: randomSecret(18) },
      });

      await tx.appointmentLog.create({
        data: { appointmentId: appt.id, oldStatus: null, newStatus: status, actorId: input.actor?.id ?? null, note: walkIn ? "Walk-in registration" : "Online booking" },
      });

      return { appointment: appt, token };
    }, TX_OPTS);
  } catch (e) {
    if (isExclusionViolation(e)) throw new AppError("SLOT_UNAVAILABLE", "Sorry, this slot was just booked by someone else. Please pick another slot.", 409);
    throw e;
  }
}

export async function rescheduleAppointment(appointmentId: string, newStartAt: string, actor?: SessionUser | null) {
  const current = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!current) throw new AppError("NOT_FOUND", "Appointment not found", 404);
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOfficer(tx, current.officerId);
      const a = await tx.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      if (a.status !== "BOOKED") throw new AppError("NOT_ALLOWED", `A ${STATUS_LABEL[a.status].toLowerCase()} appointment cannot be rescheduled`, 409);
      if (!actor && a.startAt <= new Date()) throw new AppError("NOT_ALLOWED", "This appointment has already started", 409);
      const slot = await claimSlot(tx, a.officerId, newStartAt, { ignoreAppointmentId: a.id, staffOverride: !!actor });
      const updated = await tx.appointment.update({
        where: { id: a.id },
        data: { startAt: slot.startAt, endAt: slot.endAt, seatNo: slot.seatNo },
      });
      await tx.appointmentLog.create({
        data: { appointmentId: a.id, oldStatus: a.status, newStatus: a.status, actorId: actor?.id ?? null, note: `Rescheduled from ${a.startAt.toISOString()} to ${slot.startAt.toISOString()}` },
      });
      return updated;
    }, TX_OPTS);
  } catch (e) {
    if (isExclusionViolation(e)) throw new AppError("SLOT_UNAVAILABLE", "Sorry, this slot was just booked by someone else.", 409);
    throw e;
  }
}

/** Changes status with transition + role checks, writes the audit log. Cancelling releases the slot and revokes the token. */
export async function changeStatus(appointmentId: string, to: AppointmentStatus, actor: SessionUser | null, note?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findUnique({ where: { id: appointmentId }, include: { officer: { select: { organizationId: true } } } });
    if (!a) throw new AppError("NOT_FOUND", "Appointment not found", 404);

    if (actor) {
      if (a.organizationId !== actor.organizationId) throw new AppError("NOT_FOUND", "Appointment not found", 404);
      if (actor.role === "OFFICER" && a.officerId !== actor.officerId) throw new AppError("FORBIDDEN", "This appointment belongs to another officer", 403);
      if (!ROLE_CAN_SET[actor.role].includes(to)) throw new AppError("FORBIDDEN", `Your role cannot mark appointments as ${STATUS_LABEL[to]}`, 403);
    } else if (to !== "CANCELLED") {
      throw new AppError("FORBIDDEN", "Not allowed", 403);
    }

    if (a.status === to) return a;
    if (!TRANSITIONS[a.status].includes(to)) {
      throw new AppError("BAD_TRANSITION", `Cannot change ${STATUS_LABEL[a.status]} → ${STATUS_LABEL[to]}`, 409);
    }

    const now = new Date();
    const updated = await tx.appointment.update({
      where: { id: a.id },
      data: {
        status: to,
        ...(to === "CHECKED_IN" ? { checkedInAt: now } : {}),
        ...(to === "IN_PROGRESS" ? { startedAt: now, checkedInAt: a.checkedInAt ?? now } : {}),
        ...(to === "COMPLETED" ? { completedAt: now } : {}),
        ...(to === "CANCELLED" ? { cancelledAt: now } : {}),
      },
    });
    if (to === "CANCELLED" || to === "NO_SHOW") {
      await tx.token.updateMany({ where: { appointmentId: a.id, isActive: true }, data: { isActive: false, revokedAt: now } });
    }
    await tx.appointmentLog.create({
      data: { appointmentId: a.id, oldStatus: a.status, newStatus: to, actorId: actor?.id ?? null, note: note ?? (actor ? null : "Cancelled by visitor") },
    });
    return updated;
  });
}

/** Resolves a token by QR secret or token number, scoped to an organization */
export async function findToken(orgId: string | null, q: { qrSecret?: string; tokenNumber?: string }) {
  if (!q.qrSecret && !q.tokenNumber) return null;
  const token = await prisma.token.findFirst({
    where: {
      ...(q.qrSecret ? { qrSecret: q.qrSecret } : { tokenNumber: q.tokenNumber }),
      ...(orgId ? { appointment: { organizationId: orgId } } : {}),
    },
    include: {
      appointment: {
        include: {
          visitor: true,
          organization: { select: { name: true, timezone: true, slug: true } },
          officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        },
      },
    },
  });
  return token;
}
