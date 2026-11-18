/**
 * Client setup: Chandigarh University, Unnao Campus
 * ─────────────────────────────────────────────────
 * INTERNAL staff-meeting system (PUBLIC_BOOKING=false): staff sign in and book meetings with
 * officers; designated officers (canSummon) can call anyone for an immediate meeting.
 *
 * Creates the organization, departments, one "desk" officer account per department,
 * admin + reception accounts, a few sample staff logins for testing, and fixed-date
 * national holidays. No bookings — the campus starts clean.
 *
 * EVERYTHING HERE IS A STARTING POINT. Replace with the campus's real details
 * (names, emails, hours, address, holiday calendar) — either edit this file before
 * the first seed, or change them later from the admin panel.
 *
 * Initial password for every account: CLIENT_INITIAL_PASSWORD from .env (required, never printed).
 * Everyone is forced to set their own password at first sign-in.
 * L Codes below (L9xxx) are PLACEHOLDERS — replace with the real employee codes.
 */
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";

const ORG = {
  name: "Chandigarh University, Unnao Campus",
  slug: "cu-unnao", // booking URL: /o/cu-unnao
  shortCode: "CUU", // token numbers: CUU-2026-000001
  timezone: "Asia/Kolkata",
  address: "Unnao, Uttar Pradesh", // TODO: full campus address
  email: null as string | null, // TODO: campus enquiry email
  phone: null as string | null, // TODO: campus enquiry phone
  // Staff book with their own login, so the public "I am a…" / ID fields are not needed
  visitorCategories: [] as string[],
  referenceLabel: null as string | null,
};

const EMAIL_DOMAIN = "cuunnao.test"; // TODO: replace with the campus email domain

/** Weekly hours (ISO weekday: 1 = Monday … 6 = Saturday). Sunday closed. */
const WEEKDAY_HOURS = { startTime: "09:30", endTime: "16:30", breakStart: "13:00", breakEnd: "14:00" };
const SATURDAY_HOURS = { startTime: "09:30", endTime: "13:30", breakStart: null, breakEnd: null };

type Desk = {
  department: string;
  description: string;
  name: string; // shown to visitors — can be a person's name or a desk name
  designation: string;
  email: string;
  location: string;
  slotDurationMin: number;
  bufferMin: number;
  capacityPerSlot: number;
  minNoticeMin: number;
  advanceBookingDays: number;
  allowSameDay: boolean;
  maxPerDay?: number;
  /** Designated officer: may call anyone for an immediate meeting */
  canSummon?: boolean;
  /** Bookings wait for this officer's approval */
  requiresApproval?: boolean;
  /** Longest meeting staff may book (multiple of slotDurationMin) */
  maxDurationMin: number;
  /** L Code (employee code) — placeholder */
  lCode: string;
  hours?: { weekdays: number[]; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null };
  bio: string;
};

const DESKS: Desk[] = [
  {
    department: "Admission Cell", description: "New admissions, eligibility, counselling, documents",
    name: "Admissions Desk", designation: "Admission Counsellor", email: "admissions", lCode: "L9101", maxDurationMin: 45, location: "Admission Block, Ground Floor",
    slotDurationMin: 15, bufferMin: 0, capacityPerSlot: 3, minNoticeMin: 30, advanceBookingDays: 30, allowSameDay: true,
    bio: "Admission enquiries, course counselling, eligibility and document verification.",
  },
  {
    department: "Registrar Office", description: "Certificates, transcripts, verification, migration",
    name: "Registrar Office", designation: "Registrar", email: "registrar", lCode: "L9102", maxDurationMin: 60, location: "Administrative Block", canSummon: true,
    slotDurationMin: 15, bufferMin: 5, capacityPerSlot: 1, minNoticeMin: 60, advanceBookingDays: 30, allowSameDay: true,
    bio: "Degree and provisional certificates, transcripts, bonafide and migration certificates, document verification.",
  },
  {
    department: "Examination Cell", description: "Exam forms, admit cards, results, re-evaluation",
    name: "Examination Cell", designation: "Controller of Examinations", email: "exams", lCode: "L9103", maxDurationMin: 60, location: "Examination Block",
    slotDurationMin: 20, bufferMin: 10, capacityPerSlot: 2, minNoticeMin: 60, advanceBookingDays: 30, allowSameDay: true,
    bio: "Examination forms, admit cards, results, re-evaluation and grade-sheet queries.",
  },
  {
    department: "Accounts & Fee Section", description: "Fee payment, receipts, refunds, scholarships",
    name: "Fee Counter", designation: "Accounts Officer", email: "accounts", lCode: "L9104", maxDurationMin: 30, location: "Administrative Block, Accounts Section",
    slotDurationMin: 10, bufferMin: 0, capacityPerSlot: 2, minNoticeMin: 30, advanceBookingDays: 30, allowSameDay: true,
    bio: "Fee payment issues, receipts, refunds and scholarship disbursement queries.",
  },
  {
    department: "Training & Placement Cell", description: "Placements, internships, recruiter meetings",
    name: "Placement Cell", designation: "Training & Placement Officer", email: "placements", lCode: "L9105", maxDurationMin: 90, location: "Placement Cell",
    slotDurationMin: 30, bufferMin: 0, capacityPerSlot: 1, minNoticeMin: 120, advanceBookingDays: 30, allowSameDay: true,
    bio: "Placement registration, internships, career guidance and recruiter meetings.",
  },
  {
    department: "Hostel Administration", description: "Hostel allotment, rooms, mess, leave",
    name: "Hostel Office", designation: "Chief Warden", email: "hostel", lCode: "L9106", maxDurationMin: 45, location: "Hostel Administration Office",
    slotDurationMin: 15, bufferMin: 5, capacityPerSlot: 1, minNoticeMin: 60, advanceBookingDays: 30, allowSameDay: true,
    bio: "Hostel allotment, room change, mess and hostel-leave matters.",
  },
  {
    department: "Student Welfare", description: "Student grievances, clubs, discipline, wellbeing",
    name: "Student Welfare Office", designation: "Dean Student Welfare", email: "dsw", lCode: "L9107", maxDurationMin: 60, location: "Student Activity Centre",
    slotDurationMin: 20, bufferMin: 10, capacityPerSlot: 1, minNoticeMin: 60, advanceBookingDays: 30, allowSameDay: true,
    bio: "Student grievances, clubs and societies, discipline and student wellbeing.",
  },
  {
    department: "Office of the Vice Chancellor", description: "Meetings with the Vice Chancellor (by appointment only)",
    name: "VC Office", designation: "Vice Chancellor", email: "vc", lCode: "L9108", maxDurationMin: 60, requiresApproval: true, location: "Administrative Block, First Floor", canSummon: true,
    slotDurationMin: 30, bufferMin: 15, capacityPerSlot: 1, minNoticeMin: 1440, advanceBookingDays: 14, allowSameDay: false, maxPerDay: 4,
    hours: { weekdays: [1, 2, 3, 4, 5], startTime: "11:00", endTime: "13:00", breakStart: null, breakEnd: null },
    bio: "Meetings with the Vice Chancellor. Book at least one day in advance.",
  },
];

/**
 * SAMPLE staff logins for testing only. Load the real staff list from
 * Admin → Staff → "Bulk import staff (CSV)", then deactivate these.
 */
const SAMPLE_STAFF = [
  { name: "Test Faculty (CSE)", email: "faculty.cse", employeeId: "L9201", jobTitle: "Assistant Professor", department: "Computer Science & Engineering" },
  { name: "Test Faculty (Management)", email: "faculty.mgmt", employeeId: "L9202", jobTitle: "Associate Professor", department: "Management Studies" },
  { name: "Test Staff (Library)", email: "library", employeeId: "L9203", jobTitle: "Librarian", department: "Central Library" },
  // PA: gets the Reception desk for the VC Office only
  { name: "VC's PA (sample)", email: "vc.pa", employeeId: "L9204", jobTitle: "Personal Assistant", department: "Office of the Vice Chancellor", paOf: "vc" },
];

const STAFF = [
  { name: "Campus IT Admin", email: "admin", role: "ADMIN" as const, lCode: "L9001" },
  { name: "Front Office", email: "frontoffice", role: "RECEPTIONIST" as const, lCode: "L9002" },
  { name: "Main Gate Reception", email: "reception", role: "RECEPTIONIST" as const, lCode: "L9003" },
];

/** Fixed-date national holidays. TODO: add the campus academic calendar (Diwali, Holi, Eid, etc.) from Admin → Holidays. */
const HOLIDAYS = [
  ["2026-12-25", "Christmas"],
  ["2027-01-26", "Republic Day"],
  ["2027-08-15", "Independence Day"],
  ["2027-10-02", "Gandhi Jayanti"],
];

export default async function seedCuUnnao(prisma: PrismaClient) {
  if (await prisma.organization.findUnique({ where: { slug: ORG.slug } })) {
    console.log(`"${ORG.name}" already exists — skipping. Use \`npm run db:reset\` to start fresh.`);
    return;
  }
  const password = process.env.CLIENT_INITIAL_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set CLIENT_INITIAL_PASSWORD (8+ characters) in .env before seeding");
  const hash = await bcrypt.hash(password, 10);
  const email = (local: string) => `${local}@${EMAIL_DOMAIN}`;

  const org = await prisma.organization.create({
    data: {
      name: ORG.name, slug: ORG.slug, shortCode: ORG.shortCode, timezone: ORG.timezone,
      address: ORG.address, email: ORG.email, phone: ORG.phone,
      visitorCategories: ORG.visitorCategories, referenceLabel: ORG.referenceLabel,
      holidays: { create: HOLIDAYS.map(([date, name]) => ({ date, name })) },
    },
  });

  await prisma.user.createMany({
    data: STAFF.map((s) => ({ organizationId: org.id, name: s.name, email: email(s.email), passwordHash: hash, role: s.role, employeeId: s.lCode })),
  });

  for (const d of DESKS) {
    const dept = await prisma.department.create({ data: { organizationId: org.id, name: d.department, description: d.description } });
    const hours = d.hours
      ? d.hours.weekdays.map((weekday) => ({ weekday, startTime: d.hours!.startTime, endTime: d.hours!.endTime, breakStart: d.hours!.breakStart, breakEnd: d.hours!.breakEnd }))
      : [...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, ...WEEKDAY_HOURS })), { weekday: 6, ...SATURDAY_HOURS }];
    await prisma.user.create({
      data: {
        organizationId: org.id, name: d.name, email: email(d.email), passwordHash: hash, role: "OFFICER", employeeId: d.lCode,
        officerProfile: {
          create: {
            organizationId: org.id, departmentId: dept.id, designation: d.designation, location: d.location, bio: d.bio,
            slotDurationMin: d.slotDurationMin, bufferMin: d.bufferMin, capacityPerSlot: d.capacityPerSlot,
            minNoticeMin: d.minNoticeMin, advanceBookingDays: d.advanceBookingDays, allowSameDay: d.allowSameDay, maxPerDay: d.maxPerDay ?? null,
            canSummon: d.canSummon ?? false,
            requiresApproval: d.requiresApproval ?? false,
            maxDurationMin: d.maxDurationMin,
            workingHours: { create: hours },
          },
        },
      },
    });
  }

  for (const st of SAMPLE_STAFF as (typeof SAMPLE_STAFF[number] & { paOf?: string })[]) {
    const paOfficer = st.paOf ? await prisma.officerProfile.findFirst({ where: { user: { email: email(st.paOf) } } }) : null;
    const dept = (await prisma.department.findFirst({ where: { organizationId: org.id, name: st.department } })) ?? (await prisma.department.create({ data: { organizationId: org.id, name: st.department } }));
    await prisma.user.create({
      data: { organizationId: org.id, name: st.name, email: email(st.email), passwordHash: hash, role: "STAFF", employeeId: st.employeeId, jobTitle: st.jobTitle, departmentId: dept.id, paOfficerId: paOfficer?.id ?? null },
    });
  }

  console.log(`Created "${ORG.name}" — booking portal /o/${ORG.slug}, token prefix ${ORG.shortCode}`);
  console.log(`${DESKS.length} departments/desks, ${STAFF.length} staff accounts, ${HOLIDAYS.length} holidays.`);
  console.log("Logins (initial password: CLIENT_INITIAL_PASSWORD from .env; everyone must change it at first sign-in):");
  for (const s of STAFF) console.log(`  ${s.role.padEnd(13)} ${email(s.email).padEnd(28)} L Code ${s.lCode}`);
  for (const d of DESKS) console.log(`  OFFICER       ${email(d.email).padEnd(28)} ${d.designation}${d.canSummon ? "  (can call immediate meetings)" : ""}${d.requiresApproval ? "  (approves bookings)" : ""}`);
  for (const st of SAMPLE_STAFF as (typeof SAMPLE_STAFF[number] & { paOf?: string })[]) console.log(`  STAFF         ${email(st.email).padEnd(28)} ${st.jobTitle} (sample)${st.paOf ? `  → PA of ${email(st.paOf)}` : ""}`);
}
