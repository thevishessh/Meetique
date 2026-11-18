/**
 * Integration tests for the meeting rules (run: npm test).
 *
 * They run against the database in DATABASE_URL, inside a throw-away organization
 * created at the start and deleted (with everything in it) at the end, so real data
 * is never touched. The background job (reminders, auto no-show) is not run here,
 * because it works across all organizations.
 */
import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/db";
import { getDaySlots, allowedDurations } from "../src/lib/slots";
import { bookAppointment, changeStatus, findConflicts, respondToMeeting, rescheduleAppointment, saveNotes, summonMeeting } from "../src/lib/booking";
import { nextActions, TRANSITIONS } from "../src/lib/status";
import type { SessionUser } from "../src/lib/auth";
import { runJobs } from "../src/lib/jobs";

const TZ = "Asia/Kolkata";
const tag = randomBytes(4).toString("hex");
let orgId = "";
const ids: Record<string, string> = {};
const officerIds: Record<string, string> = {};
let date = "";

const at = (hm: string) => DateTime.fromISO(`${date}T${hm}`, { zone: TZ }).toUTC().toISO()!;

/** Builds the session object the app passes around, straight from the database */
async function session(key: string): Promise<SessionUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: ids[key] }, include: { organization: true, officerProfile: true, paFor: { include: { user: true } } } });
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, organizationId: u.organizationId,
    officerId: u.officerProfile?.id ?? null, canSummon: !!u.officerProfile?.canSummon, employeeId: u.employeeId, mustChangePassword: false,
    pa: u.paFor ? { officerId: u.paFor.id, officerName: u.paFor.user.name } : null,
    org: { id: u.organization.id, name: u.organization.name, slug: u.organization.slug, timezone: u.organization.timezone, shortCode: u.organization.shortCode },
  };
}

before(async () => {
  // A weekday three or more days ahead, so no notice / same-day rule interferes
  let d = DateTime.now().setZone(TZ).plus({ days: 3 });
  while (d.weekday > 5) d = d.plus({ days: 1 });
  date = d.toFormat("yyyy-MM-dd");

  const org = await prisma.organization.create({ data: { name: `Test org ${tag}`, slug: `test-${tag}`, shortCode: "TST", timezone: TZ } });
  orgId = org.id;
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00", breakStart: "13:00", breakEnd: "14:00" }));
  const mkOfficer = async (key: string, extra: Record<string, unknown>) => {
    const u = await prisma.user.create({
      data: {
        organizationId: org.id, name: `Officer ${key}`, email: `${key}-${tag}@test.invalid`, passwordHash: "x", role: "OFFICER", employeeId: `T${key.toUpperCase()}${tag}`.slice(0, 20),
        officerProfile: { create: { organizationId: org.id, designation: key, slotDurationMin: 15, maxDurationMin: 60, bufferMin: 0, minNoticeMin: 0, capacityPerSlot: 1, workingHours: { create: hours }, ...extra } },
      },
      include: { officerProfile: true },
    });
    ids[key] = u.id;
    officerIds[key] = u.officerProfile!.id;
  };
  await mkOfficer("registrar", { canSummon: true });
  await mkOfficer("director", { requiresApproval: true });
  await mkOfficer("hostel", { capacityPerSlot: 2, bufferMin: 5 });
  for (const key of ["staff1", "staff2", "pa"]) {
    const u = await prisma.user.create({
      data: { organizationId: org.id, name: `Staff ${key}`, email: `${key}-${tag}@test.invalid`, passwordHash: "x", role: "STAFF", employeeId: `S${key.toUpperCase()}${tag}`.slice(0, 20), ...(key === "pa" ? { paOfficerId: officerIds.registrar } : {}) },
    });
    ids[key] = u.id;
  }
  await prisma.orgHoliday.create({ data: { organizationId: org.id, date: d.plus({ days: 7 }).toFormat("yyyy-MM-dd"), name: "Test holiday" } });
});

after(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("slot engine", () => {
  test("15-minute grid, lunch break left out", async () => {
    const day = await getDaySlots(officerIds.registrar, date);
    assert.equal(day.status, "OPEN");
    assert.equal(day.slots.length, 28); // 09:00-13:00 and 14:00-17:00, every 15 min
    const labels = day.slots.map((s) => s.label);
    assert.ok(!labels.includes("1:00 PM") && !labels.includes("1:30 PM"));
  });

  test("allowed meeting lengths are multiples of the slot up to the maximum", () => {
    assert.deepEqual(allowedDurations(15, 60), [15, 30, 45, 60]);
    assert.deepEqual(allowedDurations(30, 20), [30]);
  });

  test("a 60-minute meeting never runs into lunch", async () => {
    const day = await getDaySlots(officerIds.registrar, date, { durationMin: 60 });
    assert.ok(!day.slots.some((s) => s.label === "12:15 PM"), "12:15 would end at 13:15, inside the break");
    assert.ok(day.slots.some((s) => s.label === "12:00 PM"));
  });

  test("organization holiday closes online booking", async () => {
    const holiday = DateTime.fromISO(date).plus({ days: 7 }).toFormat("yyyy-MM-dd");
    const day = await getDaySlots(officerIds.registrar, holiday);
    assert.equal(day.slots.length, 0);
    assert.match(day.message ?? "", /Holiday/);
  });
});

describe("booking", () => {
  test("books a slot, then refuses the same slot for someone else", async () => {
    const first = await bookAppointment({ officerId: officerIds.registrar, startAt: at("10:00"), name: "", attendeeUserId: ids.staff1, purpose: "t1" });
    assert.equal(first.appointment.status, "BOOKED");
    assert.match(first.token.tokenNumber, /^TST-\d{4}-\d{6}$/);
    await assert.rejects(bookAppointment({ officerId: officerIds.registrar, startAt: at("10:00"), name: "", attendeeUserId: ids.staff2 }), /just booked/);
  });

  test("a 45-minute booking blocks the slots it covers", async () => {
    await bookAppointment({ officerId: officerIds.registrar, startAt: at("11:00"), durationMin: 45, name: "", attendeeUserId: ids.staff2 });
    const day = await getDaySlots(officerIds.registrar, date);
    const free = (l: string) => day.slots.find((s) => s.label === l)!.available;
    assert.equal(free("11:00 AM"), false);
    assert.equal(free("11:30 AM"), false);
    assert.equal(free("11:45 AM"), true);
  });

  test("a length the officer does not offer is refused", async () => {
    await assert.rejects(bookAppointment({ officerId: officerIds.registrar, startAt: at("15:00"), durationMin: 50, name: "", attendeeUserId: ids.staff1 }));
  });

  test("a time off the slot grid is refused", async () => {
    await assert.rejects(bookAppointment({ officerId: officerIds.registrar, startAt: at("15:07"), name: "", attendeeUserId: ids.staff1 }), /valid slot/);
  });

  test("capacity 2 takes exactly two people, on seats 1 and 2", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => bookAppointment({ officerId: officerIds.hostel, startAt: at("09:00"), name: `Walk ${i}`, phone: `90000000${10 + i}` })),
    );
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof bookAppointment>>>[];
    assert.equal(ok.length, 2);
    assert.deepEqual(ok.map((r) => r.value.appointment.seatNo).sort(), [1, 2]);
  });

  test("twenty people racing for one slot: exactly one wins", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => bookAppointment({ officerId: officerIds.registrar, startAt: at("16:00"), name: `Race ${i}`, phone: `90000001${10 + i}` })),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });
});

describe("approval", () => {
  test("a request to an approving officer is PENDING and holds the slot", async () => {
    const r = await bookAppointment({ officerId: officerIds.director, startAt: at("10:00"), name: "", attendeeUserId: ids.staff1 });
    assert.equal(r.appointment.status, "PENDING");
    const day = await getDaySlots(officerIds.director, date);
    assert.equal(day.slots.find((s) => s.label === "10:00 AM")!.available, false);
  });

  test("the officer approves; declining releases the slot and the token", async () => {
    const director = await session("director");
    const a = await bookAppointment({ officerId: officerIds.director, startAt: at("10:30"), name: "", attendeeUserId: ids.staff1 });
    assert.equal((await changeStatus(a.appointment.id, "BOOKED", director)).status, "BOOKED");
    const b = await bookAppointment({ officerId: officerIds.director, startAt: at("11:00"), name: "", attendeeUserId: ids.staff2 });
    assert.equal((await changeStatus(b.appointment.id, "DECLINED", director)).status, "DECLINED");
    const token = await prisma.token.findFirstOrThrow({ where: { appointmentId: b.appointment.id } });
    assert.equal(token.isActive, false);
    const day = await getDaySlots(officerIds.director, date);
    assert.equal(day.slots.find((s) => s.label === "11:00 AM")!.available, true);
  });
});

describe("who may change what", () => {
  test("transition table: a finished meeting cannot move", () => {
    assert.deepEqual(TRANSITIONS.COMPLETED, []);
    assert.deepEqual(nextActions("IN_PROGRESS", "RECEPTIONIST"), []);
    assert.deepEqual(nextActions("PENDING", "OFFICER"), ["BOOKED", "DECLINED", "CANCELLED"]);
  });

  test("staff cancel their own booking but cannot complete it or touch others", async () => {
    const staff1 = await session("staff1");
    const staff2 = await session("staff2");
    const a = await bookAppointment({ officerId: officerIds.registrar, startAt: at("14:00"), name: "", attendeeUserId: ids.staff1 });
    await assert.rejects(changeStatus(a.appointment.id, "COMPLETED", staff1), /cannot mark/);
    await assert.rejects(changeStatus(a.appointment.id, "CANCELLED", staff2), /not found/);
    assert.equal((await changeStatus(a.appointment.id, "CANCELLED", staff1)).status, "CANCELLED");
  });

  test("an officer cannot change another officer's meeting", async () => {
    const director = await session("director");
    const a = await bookAppointment({ officerId: officerIds.registrar, startAt: at("14:15"), name: "", attendeeUserId: ids.staff2 });
    await assert.rejects(changeStatus(a.appointment.id, "NO_SHOW", director), /another officer/);
  });

  test("a PA works the desk for their own officer only", async () => {
    const pa = await session("pa");
    const mine = await bookAppointment({ officerId: officerIds.registrar, startAt: at("14:30"), name: "", attendeeUserId: ids.staff1 });
    assert.equal((await changeStatus(mine.appointment.id, "CHECKED_IN", pa)).status, "CHECKED_IN");
    assert.equal((await changeStatus(mine.appointment.id, "WAITING", pa)).status, "WAITING");
    await assert.rejects(changeStatus(mine.appointment.id, "IN_PROGRESS", pa), /cannot mark/);
    const other = await bookAppointment({ officerId: officerIds.hostel, startAt: at("14:30"), name: "", attendeeUserId: ids.staff2 });
    await assert.rejects(changeStatus(other.appointment.id, "CHECKED_IN", pa), /not found/);
  });

  test("only the officer writes meeting notes", async () => {
    const a = await bookAppointment({ officerId: officerIds.registrar, startAt: at("14:45"), name: "", attendeeUserId: ids.staff1 });
    assert.equal((await saveNotes(a.appointment.id, await session("registrar"), "Decided: yes")).notes, "Decided: yes");
    await assert.rejects(saveNotes(a.appointment.id, await session("staff1"), "x"), /Only the officer/);
  });

  test("an attendee cannot reschedule an immediate meeting", async () => {
    const r = await summonMeeting({ actor: await session("registrar"), targetUserIds: [ids.staff1], startAt: new Date(at("15:30")), durationMin: 15, purpose: "test" });
    await assert.rejects(rescheduleAppointment(r.created[0].appointmentId, at("16:30"), null), /set by the officer/);
  });
});

describe("immediate meetings", () => {
  test("only a designated officer may call one", async () => {
    await assert.rejects(summonMeeting({ actor: await session("director"), targetUserIds: [ids.staff1], startAt: new Date(), durationMin: 15, purpose: "x" }), /not designated/);
  });

  test("cannot call yourself", async () => {
    const registrar = await session("registrar");
    await assert.rejects(summonMeeting({ actor: registrar, targetUserIds: [registrar.id], startAt: new Date(), durationMin: 15, purpose: "x" }), /yourself/);
  });

  test("a group call gives everyone their own meeting under one group id, even over a booked slot", async () => {
    const r = await summonMeeting({ actor: await session("registrar"), targetUserIds: [ids.staff1, ids.staff2], startAt: new Date(at("10:00")), durationMin: 30, purpose: "Group" });
    assert.equal(r.created.length, 2);
    assert.ok(r.groupId);
    assert.ok(r.overlaps >= 1, "10:00 was already booked");
    const seats = await prisma.appointment.findMany({ where: { groupId: r.groupId! }, select: { seatNo: true, kind: true } });
    assert.equal(new Set(seats.map((s) => s.seatNo)).size, 2);
    assert.ok(seats.every((s) => s.kind === "IMMEDIATE"));
  });

  test("the busy check finds attendees and officers already in a meeting", async () => {
    const busy = await findConflicts(orgId, [ids.staff1, ids.registrar, ids.hostel], new Date(at("10:00")), new Date(at("10:15")), TZ);
    const names = busy.map((b) => b.name).sort();
    assert.ok(names.includes("Staff staff1"));
    assert.ok(names.includes("Officer registrar"));
    assert.ok(!names.includes("Officer hostel"));
  });

  test("only the person called can answer", async () => {
    const r = await summonMeeting({ actor: await session("registrar"), targetUserIds: [ids.staff2], startAt: new Date(at("16:30")), durationMin: 15, purpose: "Answer" });
    const id = r.created[0].appointmentId;
    await assert.rejects(respondToMeeting(id, await session("staff1"), "ON_MY_WAY"), /not found/);
    assert.equal((await respondToMeeting(id, await session("staff2"), "ON_MY_WAY")).attendeeResponse, "ON_MY_WAY");
  });
});

describe("background job", () => {
  test("reminder 15 minutes ahead, auto no-show, auto-decline of a stale request", async () => {
    const now = new Date();
    const mk = (officer: string, status: "BOOKED" | "PENDING", startMin: number, endMin: number, purpose: string) =>
      bookAppointment({ officerId: officerIds[officer], startAt: at(officer === "director" ? "15:00" : "15:15"), name: "", attendeeUserId: ids.staff1, purpose }).then(async (r) => {
        await prisma.appointment.update({
          where: { id: r.appointment.id },
          data: { status, startAt: new Date(now.getTime() + startMin * 60_000), endAt: new Date(now.getTime() + endMin * 60_000), createdAt: new Date(now.getTime() - 3_600_000) },
        });
        return r.appointment.id;
      });
    const soon = await mk("hostel", "BOOKED", 10, 25, "soon");
    const missed = await mk("registrar", "BOOKED", -180, -150, "missed");
    const stale = await mk("director", "PENDING", -5, 10, "stale");

    const r = await runJobs(now, { organizationId: orgId });
    assert.deepEqual(r, { reminders: 1, noShows: 1, expired: 1 });
    const get = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } });
    assert.ok((await get(soon)).reminderSentAt);
    assert.equal((await get(missed)).status, "NO_SHOW");
    assert.equal((await get(stale)).status, "DECLINED");
    const bell = await prisma.userNotification.findMany({ where: { userId: ids.staff1 } });
    assert.ok(bell.some((n) => n.title === "Meeting in 15 minutes"));

    assert.deepEqual(await runJobs(now, { organizationId: orgId }), { reminders: 0, noShows: 0, expired: 0 }, "a second run repeats nothing");
  });
});
