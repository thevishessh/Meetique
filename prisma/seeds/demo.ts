/**
 * Demo data: ABC University (timezone Asia/Kolkata, token prefix ABC).
 * Test logins (password: CLIENT_INITIAL_PASSWORD from .env):
 *   admin@abc.test      — Organization admin
 *   registrar@abc.test  — Officer: Registrar
 *   hr@abc.test         — Officer: HR Manager
 *   exam@abc.test       — Officer: Controller of Examinations (2 visitors per slot)
 *   reception@abc.test  — Receptionist / token operator
 */

import { DateTime } from "luxon";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { AppointmentStatus } from "../../src/generated/prisma/enums";

const secret = (n: number) => randomBytes(n).toString("base64url");
const PASSWORD = process.env.CLIENT_INITIAL_PASSWORD ?? "";
const TZ = "Asia/Kolkata";

async function main(prisma: PrismaClient) {
  if (PASSWORD.length < 8) throw new Error("Set CLIENT_INITIAL_PASSWORD (8+ characters) in .env before seeding");
  const existing = await prisma.organization.findUnique({ where: { slug: "abc-university" } });
  if (existing) {
    console.log("Demo organization already exists — skipping. Run `npm run db:reset` to start fresh.");
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);

  const org = await prisma.organization.create({
    data: { name: "ABC University", slug: "abc-university", shortCode: "ABC", timezone: TZ, email: "office@abc.test", phone: "+91 11 2345 6789", address: "University Road, New Delhi" },
  });
  const [registrarDept, hrDept, examDept] = await Promise.all(
    [
      ["Registrar Office", "Certificates, transcripts, verification"],
      ["HR Department", "Staff recruitment and HR queries"],
      ["Examination Cell", "Exams, results and re-evaluation"],
    ].map(([name, description]) => prisma.department.create({ data: { organizationId: org.id, name, description } })),
  );

  await prisma.user.createMany({
    data: [
      { organizationId: org.id, name: "Priya Admin", email: "admin@abc.test", passwordHash: hash, role: "ADMIN" },
      { organizationId: org.id, name: "Suresh Kumar", email: "reception@abc.test", passwordHash: hash, role: "RECEPTIONIST" },
    ],
  });

  const weekdays = [1, 2, 3, 4, 5, 6];
  const mkOfficer = async (name: string, email: string, designation: string, departmentId: string, location: string, extra: Record<string, unknown> = {}) => {
    const u = await prisma.user.create({
      data: {
        organizationId: org.id, name, email, passwordHash: hash, role: "OFFICER",
        officerProfile: {
          create: {
            organizationId: org.id, designation, departmentId, location, slotDurationMin: 15, bufferMin: 5, minNoticeMin: 30, ...extra,
            workingHours: { create: weekdays.map((weekday) => ({ weekday, startTime: "10:00", endTime: "14:00", breakStart: "12:00", breakEnd: "12:30" })) },
          },
        },
      },
      include: { officerProfile: true },
    });
    return u.officerProfile!;
  };

  const registrar = await mkOfficer("Dr. Anita Verma", "registrar@abc.test", "Registrar", registrarDept.id, "Admin Block, Room 104", { bio: "Degree certificates, transcripts, migration and document verification." });
  const hr = await mkOfficer("Rahul Mehta", "hr@abc.test", "HR Manager", hrDept.id, "Admin Block, Room 210", { slotDurationMin: 30, bufferMin: 0 });
  const exam = await mkOfficer("Prof. S. Iyer", "exam@abc.test", "Controller of Examinations", examDept.id, "Exam Block, Ground Floor", { capacityPerSlot: 2, slotDurationMin: 20, bufferMin: 10 });

  const now = DateTime.now().setZone(TZ);
  const today = now.toFormat("yyyy-MM-dd");

  // Special evening hours today for the Registrar so the demo always has bookable slots
  await prisma.availabilityBlock.create({
    data: { officerId: registrar.id, kind: "AVAILABLE", startAt: now.startOf("day").plus({ hours: 9 }).toJSDate(), endAt: now.startOf("day").plus({ hours: 23, minutes: 45 }).toJSDate(), reason: "Extended hours (admission week)" },
  });
  // A holiday for the HR manager next week
  const nextWeek = now.plus({ days: 7 }).startOf("day");
  await prisma.availabilityBlock.create({ data: { officerId: hr.id, kind: "UNAVAILABLE", startAt: nextWeek.toJSDate(), endAt: nextWeek.plus({ hours: 23, minutes: 59 }).toJSDate(), reason: "On leave" } });

  let seq = 0;
  const visitors = [
    ["Rahul Sharma", "9876543210", "rahul@example.com", "Transcript verification"],
    ["Neha Gupta", "9811122233", null, "Degree certificate collection"],
    ["Amit Singh", "9822233344", "amit@example.com", "Migration certificate"],
    ["Fatima Khan", "9833344455", null, "Re-evaluation query"],
    ["Vikram Rao", "9844455566", null, "Job application follow-up"],
    ["Sneha Patel", "9855566677", "sneha@example.com", "Exam schedule clash"],
  ] as const;

  const book = async (officerId: string, start: DateTime, mins: number, v: (typeof visitors)[number], status: AppointmentStatus, seatNo = 1, source: "ONLINE" | "WALK_IN" = "ONLINE") => {
    const visitor = await prisma.visitor.upsert({
      where: { organizationId_phone: { organizationId: org.id, phone: v[1] } },
      create: { organizationId: org.id, name: v[0], phone: v[1], email: v[2] },
      update: {},
    });
    seq++;
    const s = start.toJSDate(), e = start.plus({ minutes: mins }).toJSDate();
    const a = await prisma.appointment.create({
      data: {
        organizationId: org.id, visitorId: visitor.id, officerId, startAt: s, endAt: e, seatNo, status, source, purpose: v[3], manageCode: secret(24),
        checkedInAt: ["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"].includes(status) ? s : null,
        startedAt: ["IN_PROGRESS", "COMPLETED"].includes(status) ? s : null,
        completedAt: status === "COMPLETED" ? e : null,
        cancelledAt: status === "CANCELLED" ? s : null,
        tokens: { create: { tokenNumber: `ABC-${now.year}-${String(seq).padStart(6, "0")}`, qrSecret: secret(18), isActive: !["CANCELLED", "NO_SHOW"].includes(status) } },
        logs: { create: { newStatus: status, note: "Seed data" } },
      },
    });
    return a;
  };

  const at = (date: string, hm: string) => DateTime.fromISO(`${date}T${hm}`, { zone: TZ });
  // Earlier today (morning)
  await book(registrar.id, at(today, "10:00"), 15, visitors[0], "COMPLETED");
  await book(registrar.id, at(today, "10:20"), 15, visitors[1], "COMPLETED");
  await book(registrar.id, at(today, "10:40"), 15, visitors[2], "NO_SHOW");
  await book(hr.id, at(today, "10:00"), 30, visitors[4], "COMPLETED");
  await book(exam.id, at(today, "10:00"), 20, visitors[5], "COMPLETED");
  await book(exam.id, at(today, "10:00"), 20, visitors[3], "CANCELLED", 2);

  // Live queue for the Registrar's evening hours (relative to now, aligned to the 20-minute grid from 09:00)
  const grid = (offset: number) => {
    const base = now.startOf("day").plus({ hours: 9 });
    const k = Math.floor(now.diff(base, "minutes").minutes / 20) + offset;
    return base.plus({ minutes: k * 20 });
  };
  if (now.hour >= 9 && now.hour < 23) {
    await book(registrar.id, grid(0), 15, visitors[3], "IN_PROGRESS");
    await book(registrar.id, grid(1), 15, visitors[5], "WAITING");
    await book(registrar.id, grid(2), 15, visitors[4], "CHECKED_IN", 1, "WALK_IN");
    if (grid(3).hour < 23) await book(registrar.id, grid(3), 15, visitors[1], "BOOKED");
  }

  // Tomorrow (or next working day)
  let d = now.plus({ days: 1 });
  while (d.weekday === 7) d = d.plus({ days: 1 });
  const next = d.toFormat("yyyy-MM-dd");
  await book(registrar.id, at(next, "10:00"), 15, visitors[0], "BOOKED");
  await book(hr.id, at(next, "11:00"), 30, visitors[2], "BOOKED");
  await book(exam.id, at(next, "10:30"), 20, visitors[5], "BOOKED");

  await prisma.tokenCounter.create({ data: { organizationId: org.id, year: now.year, lastValue: seq } });

  console.log(`Seeded "${org.name}" with ${seq} appointments.`);
  console.log(`Logins (password from CLIENT_INITIAL_PASSWORD): admin@abc.test, registrar@abc.test, hr@abc.test, exam@abc.test, reception@abc.test`);
}

export default main;
