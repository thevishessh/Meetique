import type { AppointmentStatus, Role } from "@/generated/prisma/enums";

/** Statuses that occupy a slot (PENDING requests hold their slot until decided) */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "BOOKED", "CHECKED_IN", "WAITING", "IN_PROGRESS"];

/** Statuses for which the QR token is not (or no longer) valid for entry */
export const INVALID_FOR_ENTRY: AppointmentStatus[] = ["PENDING", "CANCELLED", "NO_SHOW", "DECLINED"];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Awaiting approval",
  BOOKED: "Booked",
  CHECKED_IN: "Checked-in",
  WAITING: "Waiting",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  DECLINED: "Declined",
};

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  PENDING: "bg-yellow-50 text-yellow-800 ring-yellow-300",
  BOOKED: "bg-sky-50 text-sky-700 ring-sky-200",
  CHECKED_IN: "bg-violet-50 text-violet-700 ring-violet-200",
  WAITING: "bg-amber-50 text-amber-800 ring-amber-200",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  NO_SHOW: "bg-orange-50 text-orange-700 ring-orange-200",
  DECLINED: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Allowed status transitions. PENDING → BOOKED is "Approve". */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["BOOKED", "DECLINED", "CANCELLED"],
  BOOKED: ["CHECKED_IN", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  WAITING: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  DECLINED: [],
};

/** Which target statuses each role may set */
export const ROLE_CAN_SET: Record<Role, AppointmentStatus[]> = {
  ADMIN: ["BOOKED", "DECLINED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  OFFICER: ["BOOKED", "DECLINED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  RECEPTIONIST: ["CHECKED_IN", "WAITING", "CANCELLED", "NO_SHOW"],
  STAFF: ["CANCELLED"], // own bookings only (enforced in changeStatus)
};

export function nextActions(status: AppointmentStatus, role: Role): AppointmentStatus[] {
  return TRANSITIONS[status].filter((s) => ROLE_CAN_SET[role].includes(s));
}
