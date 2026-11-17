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
}).merge(officerSettingsSchema.partial());

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "RECEPTIONIST"]),
});

export const staffUpdateSchema = z.object({
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
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone,
  email: optEmail,
  purpose: z.string().trim().max(300).optional().nullable(),
  walkIn: z.boolean().optional(),
});

export const rescheduleSchema = z.object({ code: z.string().optional(), startAt: z.string().min(1) });

export const statusSchema = z.object({
  status: z.enum(["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  note: z.string().trim().max(300).optional(),
});

export const checkInSchema = z.object({ scan: z.string().trim().min(3) });

export const lookupSchema = z.object({ org: z.string().min(1), token: z.string().trim().min(3), phone });
