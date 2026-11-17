import { DateTime } from "luxon";
import { requirePageUser } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { isValidDate, todayIn } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/status";
import { Card, CardHeader, PageHeader, Stat, Button, Input, Empty } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const BAR: Record<AppointmentStatus, string> = {
  BOOKED: "bg-sky-500",
  CHECKED_IN: "bg-violet-500",
  WAITING: "bg-amber-500",
  IN_PROGRESS: "bg-emerald-400",
  COMPLETED: "bg-emerald-600",
  CANCELLED: "bg-rose-500",
  NO_SHOW: "bg-orange-500",
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requirePageUser("ADMIN");
  const sp = await searchParams;
  const tz = user.org.timezone;
  const to = sp.to && isValidDate(sp.to) ? sp.to : todayIn(tz);
  const from = sp.from && isValidDate(sp.from) && sp.from <= to ? sp.from : DateTime.fromISO(to).minus({ days: 29 }).toFormat("yyyy-MM-dd");
  const r = await buildReport(user.organizationId, tz, from, to);
  const pct = (n: number) => (r.total ? Math.round((n / r.total) * 100) : 0);
  const decided = r.byStatus.COMPLETED + r.byStatus.NO_SHOW;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & analytics"
        description={`${DateTime.fromISO(from).toFormat("d LLL yyyy")} – ${DateTime.fromISO(to).toFormat("d LLL yyyy")}`}
        action={
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">From<Input type="date" name="from" defaultValue={from} className="h-9 w-40" /></label>
            <label className="text-xs text-slate-500">To<Input type="date" name="to" defaultValue={to} className="h-9 w-40" /></label>
            <Button size="md" variant="secondary">Apply</Button>
            <a href={`/api/reports?from=${from}&to=${to}&format=csv`} className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Export CSV (Excel)</a>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total appointments" value={r.total} hint={`${r.walkIns} walk-ins`} />
        <Stat label="Completed" value={r.byStatus.COMPLETED} tone="text-emerald-600" hint={`${pct(r.byStatus.COMPLETED)}% of all`} />
        <Stat label="Cancelled" value={r.byStatus.CANCELLED} tone="text-rose-600" hint={`${pct(r.byStatus.CANCELLED)}% of all`} />
        <Stat label="No-show rate" value={decided ? `${Math.round((r.byStatus.NO_SHOW / decided) * 100)}%` : "—"} tone="text-orange-600" hint={`${r.byStatus.NO_SHOW} no-shows`} />
      </div>

      <Card>
        <CardHeader title="Status breakdown" />
        <div className="p-5">
          {r.total ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => r.byStatus[s] > 0 && <div key={s} className={BAR[s]} style={{ width: `${pct(r.byStatus[s])}%` }} title={`${STATUS_LABEL[s]}: ${r.byStatus[s]}`} />)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${BAR[s]}`} />
                    <span className="text-slate-600">{STATUS_LABEL[s]}</span>
                    <span className="ml-auto font-semibold tabular-nums">{r.byStatus[s]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty title="No appointments in this range" />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Officer workload" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Officer</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Completed</th>
                <th className="px-5 py-3 text-right">Cancelled</th>
                <th className="px-5 py-3 text-right">No-show</th>
                <th className="px-5 py-3 text-right">Avg meeting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {r.officers.map((o) => (
                <tr key={o.name}>
                  <td className="px-5 py-3 font-medium">{o.name}</td>
                  <td className="px-5 py-3 text-slate-600">{o.department}</td>
                  <td className="px-5 py-3 text-right">{o.total}</td>
                  <td className="px-5 py-3 text-right">{o.completed}</td>
                  <td className="px-5 py-3 text-right">{o.cancelled}</td>
                  <td className="px-5 py-3 text-right">{o.noShow}</td>
                  <td className="px-5 py-3 text-right">{o.avgMeetingMin != null ? `${o.avgMeetingMin} min` : "—"}</td>
                </tr>
              ))}
              {!r.officers.length && <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
