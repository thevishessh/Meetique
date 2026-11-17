import { DateTime } from "luxon";
import { requirePageUser } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { isValidDate, todayIn } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/status";
import { Card, CardHeader, PageHeader, Stat, Stats, Button, Input, Empty } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** Ink: teal for states that mean in, ink for in progress, greys for the ones that ended */
const BAR: Record<AppointmentStatus, string> = {
  PENDING: "bg-edge",
  BOOKED: "bg-ink-2",
  CHECKED_IN: "bg-accent",
  WAITING: "bg-accent-deep",
  IN_PROGRESS: "bg-ink",
  COMPLETED: "bg-accent-soft",
  CANCELLED: "bg-rule",
  NO_SHOW: "bg-muted",
  DECLINED: "bg-paper-3",
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
        description={`${DateTime.fromISO(from).toFormat("d LLL yyyy")} to ${DateTime.fromISO(to).toFormat("d LLL yyyy")}`}
        action={
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">From<Input type="date" name="from" defaultValue={from} className="h-9 w-40" /></label>
            <label className="text-xs text-muted">To<Input type="date" name="to" defaultValue={to} className="h-9 w-40" /></label>
            <Button size="md" variant="secondary">Apply</Button>
            <a href={`/api/reports?from=${from}&to=${to}&format=csv`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper hover:bg-ink">Export CSV (Excel)</a>
          </form>
        }
      />

      <Stats>
        <Stat label="Total appointments" value={r.total} hint={`${r.walkIns} walk-ins`} />
        <Stat label="Completed" value={r.byStatus.COMPLETED} hint={`${pct(r.byStatus.COMPLETED)}% of all`} />
        <Stat label="Cancelled" value={r.byStatus.CANCELLED} hint={`${pct(r.byStatus.CANCELLED)}% of all`} />
        <Stat label="No-show rate" value={decided ? `${Math.round((r.byStatus.NO_SHOW / decided) * 100)}%` : "None yet"} hint={`${r.byStatus.NO_SHOW} no-shows`} />
      </Stats>

      <Card>
        <CardHeader title="Status breakdown" />
        <div className="p-5">
          {r.total ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-paper-3">
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => r.byStatus[s] > 0 && <div key={s} className={BAR[s]} style={{ width: `${pct(r.byStatus[s])}%` }} title={`${STATUS_LABEL[s]}: ${r.byStatus[s]}`} />)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${BAR[s]}`} />
                    <span className="text-ink-2">{STATUS_LABEL[s]}</span>
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
              <tr className="border-b border-ink text-left text-sm text-muted">
                <th className="px-5 py-3">Officer</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Completed</th>
                <th className="px-5 py-3 text-right">Cancelled</th>
                <th className="px-5 py-3 text-right">No-show</th>
                <th className="px-5 py-3 text-right">Avg meeting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule tabular-nums">
              {r.officers.map((o) => (
                <tr key={o.name}>
                  <td className="px-5 py-3 font-medium">{o.name}</td>
                  <td className="px-5 py-3 text-ink-2">{o.department}</td>
                  <td className="px-5 py-3 text-right">{o.total}</td>
                  <td className="px-5 py-3 text-right">{o.completed}</td>
                  <td className="px-5 py-3 text-right">{o.cancelled}</td>
                  <td className="px-5 py-3 text-right">{o.noShow}</td>
                  <td className="px-5 py-3 text-right">{o.avgMeetingMin != null ? `${o.avgMeetingMin} min` : "Not yet"}</td>
                </tr>
              ))}
              {!r.officers.length && <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
