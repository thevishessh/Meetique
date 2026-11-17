import Link from "next/link";
import type { AppointmentStatus, Role } from "@/generated/prisma/enums";
import { fmtRange } from "@/lib/time";
import { nextActions } from "@/lib/status";
import { Badge, Empty, StatusBadge } from "./ui";
import { StatusActions } from "./status-actions";

export type ApptRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  source: "ONLINE" | "WALK_IN";
  purpose: string | null;
  officerId: string;
  visitor: { name: string; phone: string; email: string | null };
  tokens: { tokenNumber: string; qrSecret: string }[];
  officer: { user: { name: string } };
};

export function AppointmentTable({ rows, tz, role, officerId, showOfficer = true, empty = "No appointments" }: { rows: ApptRow[]; tz: string; role: Role; officerId?: string | null; showOfficer?: boolean; empty?: string }) {
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Token</th>
            <th className="px-4 py-3">Visitor</th>
            {showOfficer && <th className="px-4 py-3">Officer</th>}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const actions = role === "OFFICER" && r.officerId !== officerId ? [] : nextActions(r.status, role);
            const t = r.tokens[0];
            return (
              <tr key={r.id} className="align-top hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{fmtRange(r.startAt, r.endAt, tz)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {t ? <Link href={`/t/${t.qrSecret}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">{t.tokenNumber}</Link> : "—"}
                  {r.source === "WALK_IN" && <div className="mt-1"><Badge tone="amber">Walk-in</Badge></div>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{r.visitor.name}</div>
                  <div className="text-xs text-slate-500">{r.visitor.phone}{r.visitor.email ? ` · ${r.visitor.email}` : ""}</div>
                  {r.purpose && <div className="mt-1 max-w-xs text-xs text-slate-600">“{r.purpose}”</div>}
                </td>
                {showOfficer && <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.officer.user.name}</td>}
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">{actions.length ? <StatusActions id={r.id} actions={actions} /> : <span className="text-xs text-slate-400">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const apptInclude = {
  visitor: { select: { name: true, phone: true, email: true } },
  tokens: { where: { isActive: true }, take: 1, select: { tokenNumber: true, qrSecret: true } },
  officer: { select: { user: { select: { name: true } } } },
} as const;
