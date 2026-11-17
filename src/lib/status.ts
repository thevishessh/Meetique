import type { AppointmentStatus, Role } from "@/generated/prisma/enums";

/** Statuses that occupy a slot */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["BOOKED", "CHECKED_IN", "WAITING", "IN_PROGRESS"];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Booked",
  CHECKED_IN: "Checked-in",
  WAITING: "Waiting",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  BOOKED: "bg-sky-50 text-sky-700 ring-sky-200",
  CHECKED_IN: "bg-violet-50 text-violet-700 ring-violet-200",
  WAITING: "bg-amber-50 text-amber-800 ring-amber-200",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  NO_SHOW: "bg-orange-50 text-orange-700 ring-orange-200",
};

/** Allowed status transitions */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ["CHECKED_IN", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  WAITING: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Which target statuses each role may set */
export const ROLE_CAN_SET: Record<Role, AppointmentStatus[]> = {
  ADMIN: ["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  OFFICER: ["CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  RECEPTIONIST: ["CHECKED_IN", "WAITING", "CANCELLED", "NO_SHOW"],
};

export function nextActions(status: AppointmentStatus, role: Role): AppointmentStatus[] {
  return TRANSITIONS[status].filter((s) => ROLE_CAN_SET[role].includes(s));
}
