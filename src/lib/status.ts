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

/** Ink state pills (classes in globals.css): in = teal, on = ink, out = outline, wait = ink outline */
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  PENDING: "tag--wait",
  BOOKED: "",
  CHECKED_IN: "tag--in",
  WAITING: "tag--in",
  IN_PROGRESS: "tag--on",
  COMPLETED: "tag--out",
  CANCELLED: "tag--out",
  NO_SHOW: "tag--out",
  DECLINED: "tag--out",
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
