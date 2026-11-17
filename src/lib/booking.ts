import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus, AppointmentSource, AttendeeResponse } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { AppError, isExclusionViolation } from "./errors";
import { getDaySlots } from "./slots";
import { ACTIVE_STATUSES, ROLE_CAN_SET, TRANSITIONS, STATUS_LABEL } from "./status";
import { formatTokenNumber, randomSecret } from "./tokens";
import { fmtRange, localDateOf } from "./time";
import type { SessionUser } from "./auth";

type Tx = Prisma.TransactionClient;

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 } as const;

/** Serialize all booking writes for one officer (row lock held until commit) */
async function lockOfficer(tx: Tx, officerId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM officer_profiles WHERE id = ${officerId} FOR UPDATE`;
  if (!rows.length) throw new AppError("NOT_FOUND", "Officer not found", 404);
}

/** Validates that `startAt` (for `durationMin`) is a real, currently free slot, and picks a free seat */
async function claimSlot(tx: Tx, officerId: string, startAt: string, opts: { staffOverride?: boolean; ignoreAppointmentId?: string; durationMin?: number }) {
  const officer = await tx.officerProfile.findUniqueOrThrow({
    where: { id: officerId },
    include: { user: { select: { organization: { select: { timezone: true } } } } },
  });
  const tz = officer.user.organization.timezone;
  const start = DateTime.fromISO(startAt);
  if (!start.isValid) throw new AppError("BAD_SLOT", "Invalid slot time", 422);
  const date = localDateOf(start.toJSDate(), tz);

  const day = await getDaySlots(officerId, date, opts, tx);
  if (opts.durationMin && day.durationMin !== opts.durationMin) {
    throw new AppError("BAD_DURATION", `Meetings with this officer can be ${day.durations.join(", ")} minutes`, 422);
  }
  const slot = day.slots.find((s) => DateTime.fromISO(s.start).toMillis() === start.toMillis());
  if (!slot) throw new AppError("BAD_SLOT", day.message ?? "That time is not a valid slot for this officer", 422);
  if (!slot.available) {
    const msg: Record<string, string> = {
      FULL: "Sorry, this time was just booked by someone else (or doesn't fit the meeting length). Please pick another slot.",
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

/** Visitor card: linked to a staff user (internal), or keyed by mobile number (walk-in / public) */
async function upsertVisitor(tx: Tx, orgId: string, input: { name: string; phone?: string | null; email?: string | null; attendeeUserId?: string | null }) {
  if (input.attendeeUserId) {
    const u = await tx.user.findFirst({ where: { id: input.attendeeUserId, organizationId: orgId, isActive: true } });
    if (!u) throw new AppError("NOT_FOUND", "Staff member not found", 404);
    return tx.visitor.upsert({
      where: { userId: u.id },
      create: { organizationId: orgId, userId: u.id, name: u.name, phone: u.phone, email: u.email },
      update: { name: u.name, phone: u.phone, email: u.email },
    });
  }
  const phone = (input.phone ?? "").replace(/[^\d+]/g, "");
  if (phone.length < 7) throw new AppError("VALIDATION", "Mobile number is required", 422);
  return tx.visitor.upsert({
    where: { organizationId_phone: { organizationId: orgId, phone } },
    create: { organizationId: orgId, name: input.name, phone, email: input.email || null },
    update: { name: input.name, ...(input.email ? { email: input.email } : {}) },
  });
}

export type BookingInput = {
  officerId: string;
  startAt: string;
  /** Meeting length; must be one of the officer's allowed lengths (default: slot length) */
  durationMin?: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Staff member attending (internal booking). Their profile is used as the visitor card. */
  attendeeUserId?: string | null;
  purpose?: string | null;
  visitorCategory?: string | null;
  referenceNo?: string | null;
  source?: AppointmentSource;
  actor?: SessionUser | null;
};

/**
 * Atomic booking:
 *  1. transaction starts, officer row locked (concurrent bookings for this officer queue up)
 *  2. slot re-validated on the server for the chosen length + free seat chosen
 *  3. visitor upserted, appointment created (PENDING if the officer approves bookings)
 *  4. token number from per-org/year counter, random QR secret
 *  5. audit log, commit — the exclusion constraint is the final guard
 */
export async function bookAppointment(input: BookingInput) {
  const walkIn = input.source === "WALK_IN";
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOfficer(tx, input.officerId);
      const { startAt, endAt, seatNo, officer } = await claimSlot(tx, input.officerId, input.startAt, { staffOverride: walkIn, durationMin: input.durationMin });
      const org = await tx.organization.findUniqueOrThrow({ where: { id: officer.organizationId } });
      if (input.actor && input.actor.organizationId !== org.id) throw new AppError("FORBIDDEN", "Wrong organization", 403);

      const visitor = await upsertVisitor(tx, org.id, input);

      const status: AppointmentStatus = walkIn ? "CHECKED_IN" : officer.requiresApproval ? "PENDING" : "BOOKED";
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
          visitorCategory: org.visitorCategories.includes(input.visitorCategory ?? "") ? input.visitorCategory : null,
          referenceNo: input.referenceNo || null,
          manageCode: randomSecret(24),
          checkedInAt: walkIn ? new Date() : null,
          requestedById: input.actor?.id ?? input.attendeeUserId ?? null,
        },
      });

      const tokenNumber = await nextTokenNumber(tx, org.id, org.shortCode, org.timezone);
      const token = await tx.token.create({
        data: { appointmentId: appt.id, tokenNumber, qrSecret: randomSecret(18) },
      });

      await tx.appointmentLog.create({
        data: {
          appointmentId: appt.id,
          oldStatus: null,
          newStatus: status,
          actorId: input.actor?.id ?? input.attendeeUserId ?? null,
          note: walkIn ? "Walk-in registration" : status === "PENDING" ? "Booking request (awaiting approval)" : "Booked",
        },
      });

      return { appointment: appt, token };
    }, TX_OPTS);
  } catch (e) {
    if (isExclusionViolation(e)) throw new AppError("SLOT_UNAVAILABLE", "Sorry, this slot was just booked by someone else. Please pick another slot.", 409);
    throw e;
  }
}

export type Busy = { userId: string; name: string; items: string[] };

/**
 * Who among `userIds` already has something during [start, end):
 * meetings they attend, and — for officers — meetings in their own queue.
 */
export async function findConflicts(orgId: string, userIds: string[], start: Date, end: Date, tz: string): Promise<Busy[]> {
  if (!userIds.length) return [];
  const [asAttendee, asOfficer, users] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: orgId, status: { in: ACTIVE_STATUSES }, startAt: { lt: end }, endAt: { gt: start }, visitor: { userId: { in: userIds } } },
      include: { visitor: { select: { userId: true } }, officer: { select: { user: { select: { name: true } } } } },
    }),
    prisma.appointment.findMany({
      where: { organizationId: orgId, status: { in: ACTIVE_STATUSES }, startAt: { lt: end }, endAt: { gt: start }, officer: { userId: { in: userIds } } },
      include: { officer: { select: { userId: true } }, visitor: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ]);
  const map = new Map<string, string[]>();
  const add = (id: string, text: string) => map.set(id, [...(map.get(id) ?? []), text]);
  for (const a of asAttendee) add(a.visitor.userId!, `${fmtRange(a.startAt, a.endAt, tz)} meeting with ${a.officer.user.name}`);
  for (const a of asOfficer) add(a.officer.userId, `${fmtRange(a.startAt, a.endAt, tz)} has ${a.visitor.name} in their queue`);
  return users.filter((u) => map.has(u.id)).map((u) => ({ userId: u.id, name: u.name, items: map.get(u.id)! }));
}

/**
 * Immediate meeting: a designated officer (canSummon) calls one or more people in, now or at a set time.
 * Skips the slot engine (no notice / working-hours / capacity rules) — it is a priority call —
 * but still runs inside the officer lock and gives every attendee the next free seat, so the
 * exclusion constraint keeps working. Several people called together share a groupId.
 */
export async function summonMeeting(input: { actor: SessionUser; targetUserIds: string[]; startAt: Date; durationMin: number; purpose: string }) {
  const { actor } = input;
  if (!actor.officerId) throw new AppError("FORBIDDEN", "Only officers can call immediate meetings", 403);
  const targets = [...new Set(input.targetUserIds)];
  if (!targets.length) throw new AppError("VALIDATION", "Choose who to call", 422);
  if (targets.includes(actor.id)) throw new AppError("VALIDATION", "You cannot call a meeting with yourself", 422);
  return prisma.$transaction(async (tx) => {
    await lockOfficer(tx, actor.officerId!);
    const officer = await tx.officerProfile.findUniqueOrThrow({ where: { id: actor.officerId! } });
    if (!officer.canSummon) throw new AppError("FORBIDDEN", "You are not designated to call immediate meetings", 403);
    const org = await tx.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });

    const startAt = input.startAt;
    const endAt = new Date(startAt.getTime() + input.durationMin * 60_000);
    const overlapping = await tx.appointment.findMany({
      where: { officerId: officer.id, status: { in: ACTIVE_STATUSES }, startAt: { lt: endAt }, endAt: { gt: startAt } },
      select: { seatNo: true },
    });
    const taken = new Set(overlapping.map((o) => o.seatNo));
    const groupId = targets.length > 1 ? randomUUID() : null;
    const created: { appointmentId: string; tokenNumber: string; userId: string }[] = [];

    for (const userId of targets) {
      let seatNo = 1;
      while (taken.has(seatNo)) seatNo++;
      taken.add(seatNo);
      const visitor = await upsertVisitor(tx, org.id, { name: "", attendeeUserId: userId });
      const appt = await tx.appointment.create({
        data: {
          organizationId: org.id, visitorId: visitor.id, officerId: officer.id, startAt, endAt, seatNo,
          status: "BOOKED", source: "ONLINE", kind: "IMMEDIATE", purpose: input.purpose, groupId,
          manageCode: randomSecret(24), requestedById: actor.id,
        },
      });
      const tokenNumber = await nextTokenNumber(tx, org.id, org.shortCode, org.timezone);
      await tx.token.create({ data: { appointmentId: appt.id, tokenNumber, qrSecret: randomSecret(18) } });
      await tx.appointmentLog.create({
        data: {
          appointmentId: appt.id, newStatus: "BOOKED", actorId: actor.id,
          note: `Immediate meeting called by ${actor.name}${targets.length > 1 ? ` (group of ${targets.length})` : ""}${overlapping.length ? ` — overlaps ${overlapping.length} booking(s) in the officer's queue` : ""}`,
        },
      });
      created.push({ appointmentId: appt.id, tokenNumber, userId });
    }
    return { created, groupId, overlaps: overlapping.length };
  }, TX_OPTS);
}

/** The called person answers an immediate meeting: Acknowledged / On my way */
export async function respondToMeeting(appointmentId: string, user: SessionUser, response: AttendeeResponse) {
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { visitor: { select: { userId: true } } } });
  if (!a || a.visitor.userId !== user.id) throw new AppError("NOT_FOUND", "Meeting not found", 404);
  if (!ACTIVE_STATUSES.includes(a.status)) throw new AppError("NOT_ALLOWED", "This meeting is no longer active", 409);
  const updated = await prisma.appointment.update({ where: { id: a.id }, data: { attendeeResponse: response, respondedAt: new Date() } });
  await prisma.appointmentLog.create({
    data: { appointmentId: a.id, oldStatus: a.status, newStatus: a.status, actorId: user.id, note: response === "ON_MY_WAY" ? "Attendee: on my way" : "Attendee: acknowledged" },
  });
  return updated;
}

export async function rescheduleAppointment(appointmentId: string, newStartAt: string, actor?: SessionUser | null) {
  const current = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!current) throw new AppError("NOT_FOUND", "Appointment not found", 404);
  try {
    return await prisma.$transaction(async (tx) => {
      await lockOfficer(tx, current.officerId);
      const a = await tx.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      if (a.status !== "BOOKED" && a.status !== "PENDING") throw new AppError("NOT_ALLOWED", `A ${STATUS_LABEL[a.status].toLowerCase()} appointment cannot be rescheduled`, 409);
      if (!actor && a.startAt <= new Date()) throw new AppError("NOT_ALLOWED", "This appointment has already started", 409);
      if (!actor && a.kind === "IMMEDIATE") throw new AppError("NOT_ALLOWED", "An immediate meeting's time is set by the officer who called it", 409);
      const durationMin = Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000);
      const slot = await claimSlot(tx, a.officerId, newStartAt, { ignoreAppointmentId: a.id, staffOverride: !!actor, durationMin });
      const updated = await tx.appointment.update({
        where: { id: a.id },
        data: { startAt: slot.startAt, endAt: slot.endAt, seatNo: slot.seatNo, reminderSentAt: null },
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

/** Changes status with transition + role checks, writes the audit log. Cancel / decline / no-show release the slot and revoke the token. */
export async function changeStatus(appointmentId: string, to: AppointmentStatus, actor: SessionUser | null, note?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findUnique({ where: { id: appointmentId }, include: { officer: { select: { organizationId: true } } } });
    if (!a) throw new AppError("NOT_FOUND", "Appointment not found", 404);

    if (actor) {
      if (a.organizationId !== actor.organizationId) throw new AppError("NOT_FOUND", "Appointment not found", 404);
      if (actor.role === "STAFF") {
        const v = await tx.visitor.findUnique({ where: { id: a.visitorId }, select: { userId: true } });
        if (v?.userId !== actor.id) throw new AppError("NOT_FOUND", "Appointment not found", 404);
        if (a.kind === "IMMEDIATE") throw new AppError("FORBIDDEN", "An immediate meeting called by an officer cannot be cancelled by the attendee", 403);
      } else if (actor.role === "OFFICER" && a.officerId !== actor.officerId) {
        throw new AppError("FORBIDDEN", "This appointment belongs to another officer", 403);
      }
      if (!ROLE_CAN_SET[actor.role].includes(to)) throw new AppError("FORBIDDEN", `Your role cannot mark appointments as ${STATUS_LABEL[to]}`, 403);
    } else if (to !== "CANCELLED" && to !== "NO_SHOW" && to !== "DECLINED") {
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
        ...(to === "CANCELLED" || to === "DECLINED" ? { cancelledAt: now } : {}),
      },
    });
    if (to === "CANCELLED" || to === "NO_SHOW" || to === "DECLINED") {
      await tx.token.updateMany({ where: { appointmentId: a.id, isActive: true }, data: { isActive: false, revokedAt: now } });
    }
    await tx.appointmentLog.create({
      data: {
        appointmentId: a.id, oldStatus: a.status, newStatus: to, actorId: actor?.id ?? null,
        note: note ?? (to === "BOOKED" && a.status === "PENDING" ? "Approved" : actor ? null : "Cancelled by visitor"),
      },
    });
    return updated;
  });
}

/** Officer (own meeting) or admin writes the meeting notes / outcome */
export async function saveNotes(appointmentId: string, actor: SessionUser, notes: string) {
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!a || a.organizationId !== actor.organizationId) throw new AppError("NOT_FOUND", "Appointment not found", 404);
  if (!(actor.role === "ADMIN" || (actor.role === "OFFICER" && a.officerId === actor.officerId))) throw new AppError("FORBIDDEN", "Only the officer can write notes for this meeting", 403);
  return prisma.appointment.update({ where: { id: a.id }, data: { notes: notes.trim() || null } });
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
