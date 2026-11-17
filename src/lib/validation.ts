import { z } from "zod";

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const phone = z.string().trim().min(7, "Enter a valid mobile number").max(20).regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid mobile number");
const optEmail = z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional().nullable();

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const orgRegisterSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and dashes"),
  shortCode: z.string().trim().toUpperCase().min(2).max(6).regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  timezone: z.string().min(1),
  adminName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const orgUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().min(1),
  email: optEmail,
  phone: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  /** Comma-separated list from the form, or an array */
  visitorCategories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : (Array.isArray(v) ? v : v.split(",")).map((x) => x.trim()).filter(Boolean).slice(0, 20))),
  referenceLabel: z.string().trim().max(60).optional().nullable(),
});

export const departmentSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional().nullable() });

export const officerSettingsSchema = z.object({
  slotDurationMin: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 45, 60, 90, 120].includes(v), "Pick a supported duration"),
  bufferMin: z.coerce.number().int().min(0).max(60),
  capacityPerSlot: z.coerce.number().int().min(1).max(100),
  maxPerDay: z.coerce.number().int().min(1).max(500).nullable().optional(),
  advanceBookingDays: z.coerce.number().int().min(1).max(365),
  minNoticeMin: z.coerce.number().int().min(0).max(10080),
  allowSameDay: z.boolean(),
  isBookable: z.boolean(),
});

export const officerCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  designation: z.string().trim().min(2).max(80),
  departmentId: z.string().optional().nullable(),
  location: z.string().trim().max(80).optional().nullable(),
});

export const officerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  designation: z.string().trim().min(2).max(80).optional(),
  departmentId: z.string().optional().nullable(),
  location: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  canSummon: z.boolean().optional(),
}).merge(officerSettingsSchema.partial());

const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "RECEPTIONIST", "STAFF"]),
  employeeId: optText(40),
  jobTitle: optText(80),
  phone: optText(20),
  departmentId: optText(40),
});

/** Bulk import: one staff member per CSV line → name,email,employeeId,department,jobTitle,phone */
export const staffImportSchema = z.object({ csv: z.string().min(3).max(500_000), password: z.string().min(8, "Initial password must be at least 8 characters") });

export const staffUpdateSchema = z.object({
  employeeId: optText(40),
  jobTitle: optText(80),
  phone: optText(20),
  departmentId: optText(40),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

export const workingHoursSchema = z.object({
  officerId: z.string().optional(),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        enabled: z.boolean(),
        startTime: hm,
        endTime: hm,
        breakStart: z.union([hm, z.literal("")]).optional().nullable(),
        breakEnd: z.union([hm, z.literal("")]).optional().nullable(),
      }),
    )
    .length(7),
  settings: officerSettingsSchema.optional(),
});

export const blockSchema = z.object({
  officerId: z.string().optional(),
  kind: z.enum(["UNAVAILABLE", "AVAILABLE"]),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  reason: z.string().trim().max(120).optional().nullable(),
});

export const bookingSchema = z.object({
  officerId: z.string().min(1),
  startAt: z.string().min(1),
  name: z.string().trim().min(2, "Enter your full name").max(80).optional(),
  phone: phone.optional(),
  email: optEmail,
  purpose: z.string().trim().max(300).optional().nullable(),
  visitorCategory: z.string().trim().max(60).optional().nullable(),
  referenceNo: z.string().trim().max(60).optional().nullable(),
  walkIn: z.boolean().optional(),
});

export const rescheduleSchema = z.object({ code: z.string().optional(), startAt: z.string().min(1) });

export const statusSchema = z.object({
  status: z.enum(["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  note: z.string().trim().max(300).optional(),
});

export const checkInSchema = z.object({ scan: z.string().trim().min(3) });

export const lookupSchema = z.object({ org: z.string().min(1), token: z.string().trim().min(3), phone });

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd");
export const holidaySchema = z.object({ date: ymd, endDate: z.union([ymd, z.literal("")]).optional().nullable(), name: z.string().trim().min(2).max(80) });

export const passwordChangeSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, "New password must be at least 8 characters") })
  .refine((d) => d.currentPassword !== d.newPassword, { message: "New password must be different", path: ["newPassword"] });
