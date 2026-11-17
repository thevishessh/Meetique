import { DateTime } from "luxon";
import { prisma } from "./db";
import { STATUS_LABEL } from "./status";
import { fmtDate, fmtRange } from "./time";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export async function buildReport(orgId: string, tz: string, from: string, to: string) {
  const start = DateTime.fromISO(from, { zone: tz }).startOf("day").toJSDate();
  const end = DateTime.fromISO(to, { zone: tz }).startOf("day").plus({ days: 1 }).toJSDate();
  const rows = await prisma.appointment.findMany({
    where: { organizationId: orgId, startAt: { gte: start, lt: end } },
    include: {
      visitor: { include: { user: { select: { employeeId: true, jobTitle: true } } } },
      requestedBy: { select: { name: true } },
      tokens: { orderBy: { issuedAt: "desc" }, take: 1 },
      officer: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });

  const byStatus = Object.fromEntries(Object.keys(STATUS_LABEL).map((k) => [k, 0])) as Record<AppointmentStatus, number>;
  const byOfficer = new Map<string, { name: string; department: string; total: number; completed: number; noShow: number; cancelled: number; avgMin: number[] }>();
  for (const r of rows) {
    byStatus[r.status]++;
    const k = r.officerId;
    const o = byOfficer.get(k) ?? { name: r.officer.user.name, department: r.officer.department?.name ?? "—", total: 0, completed: 0, noShow: 0, cancelled: 0, avgMin: [] };
    o.total++;
    if (r.status === "COMPLETED") {
      o.completed++;
      if (r.startedAt && r.completedAt) o.avgMin.push((r.completedAt.getTime() - r.startedAt.getTime()) / 60000);
    }
    if (r.status === "NO_SHOW") o.noShow++;
    if (r.status === "CANCELLED") o.cancelled++;
    byOfficer.set(k, o);
  }
  const officers = [...byOfficer.values()].map(({ avgMin, ...o }) => ({
    ...o,
    avgMeetingMin: avgMin.length ? Math.round(avgMin.reduce((a, b) => a + b, 0) / avgMin.length) : null,
  }));
  const total = rows.length;
  const walkIns = rows.filter((r) => r.source === "WALK_IN").length;
  return {
    from,
    to,
    total,
    walkIns,
    byStatus,
    officers: officers.sort((a, b) => b.total - a.total),
    rows: rows.map((r) => ({
      token: r.tokens[0]?.tokenNumber ?? "",
      date: fmtDate(r.startAt, tz),
      time: fmtRange(r.startAt, r.endAt, tz),
      officer: r.officer.user.name,
      department: r.officer.department?.name ?? "",
      visitor: r.visitor.name,
      employeeId: r.visitor.user?.employeeId ?? "",
      jobTitle: r.visitor.user?.jobTitle ?? "",
      phone: r.visitor.phone ?? "",
      email: r.visitor.email ?? "",
      visitorType: r.visitorCategory ?? "",
      reference: r.referenceNo ?? "",
      purpose: r.purpose ?? "",
      type: r.kind === "IMMEDIATE" ? `Immediate (called by ${r.requestedBy?.name ?? "officer"})` : r.source === "WALK_IN" ? "Walk-in" : "Booked",
      status: STATUS_LABEL[r.status],
    })),
  };
}

export function toCsv(rows: Record<string, string>[]): string {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const esc = (v: string) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\r\n");
}
