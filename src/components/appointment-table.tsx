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
  visitorCategory?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  officerId: string;
  kind?: "SCHEDULED" | "IMMEDIATE";
  attendeeResponse?: "ACKNOWLEDGED" | "ON_MY_WAY" | null;
  requestedBy?: { name: string } | null;
  visitor: { name: string; phone: string | null; email: string | null; user?: { employeeId: string | null; jobTitle: string | null } | null };
  tokens: { tokenNumber: string; qrSecret: string }[];
  officer: { user: { name: string } };
};

export function AppointmentTable({ rows, tz, role, officerId, showOfficer = true, empty = "No appointments" }: { rows: ApptRow[]; tz: string; role: Role; officerId?: string | null; showOfficer?: boolean; empty?: string }) {
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-sm text-muted">
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">Time</th>
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">Token</th>
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">Person</th>
            {showOfficer && <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">Officer</th>}
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">State</th>
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r) => {
            const actions = role === "OFFICER" && r.officerId !== officerId ? [] : nextActions(r.status, role);
            const t = r.tokens[0];
            const meta = [r.visitor.user?.jobTitle, r.visitor.user?.employeeId && `L Code ${r.visitor.user.employeeId}`, r.visitor.phone, r.visitor.email].filter(Boolean).join(", ");
            return (
              <tr key={r.id} className="align-top">
                <td className="num whitespace-nowrap px-5 py-4 font-semibold text-ink">{fmtRange(r.startAt, r.endAt, tz)}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  {t ? <Link href={`/t/${t.qrSecret}`} className="link token-no text-sm">{t.tokenNumber}</Link> : <span className="text-muted">None</span>}
                  {r.source === "WALK_IN" && <div className="mt-2"><Badge tone="amber">Walk-in</Badge></div>}
                </td>
                <td className="min-w-56 px-5 py-4">
                  <div className="font-semibold text-ink">{r.visitor.name}</div>
                  {meta && <div className="mt-0.5 text-sm text-muted">{meta}</div>}
                  {r.kind === "IMMEDIATE" && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone="rose">Immediate</Badge>
                      <ResponseBadge r={r} />
                    </div>
                  )}
                  {r.kind === "IMMEDIATE" && <div className="mt-1 text-sm text-ink-2">Called by {r.requestedBy?.name ?? "the officer"}</div>}
                  {(r.visitorCategory || r.referenceNo) && <div className="mt-1 text-sm text-ink-2">{[r.visitorCategory, r.referenceNo].filter(Boolean).join(", ")}</div>}
                  {r.purpose && <div className="mt-1 max-w-sm text-sm text-ink-2">“{r.purpose}”</div>}
                </td>
                {showOfficer && <td className="whitespace-nowrap px-5 py-4 text-ink-2">{r.officer.user.name}</td>}
                <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-4">{actions.length ? <StatusActions id={r.id} actions={actions} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResponseBadge({ r }: { r: Pick<ApptRow, "kind" | "attendeeResponse" | "status"> }) {
  if (r.kind !== "IMMEDIATE" || !["BOOKED", "CHECKED_IN", "WAITING"].includes(r.status)) return null;
  if (r.attendeeResponse === "ON_MY_WAY") return <Badge tone="green">On the way</Badge>;
  if (r.attendeeResponse === "ACKNOWLEDGED") return <Badge tone="brand">Acknowledged</Badge>;
  return <Badge tone="amber">Not yet acknowledged</Badge>;
}

export const apptInclude = {
  requestedBy: { select: { name: true } },
  visitor: { select: { name: true, phone: true, email: true, user: { select: { employeeId: true, jobTitle: true } } } },
  tokens: { where: { isActive: true }, take: 1, select: { tokenNumber: true, qrSecret: true } },
  officer: { select: { user: { select: { name: true } } } },
} as const;
