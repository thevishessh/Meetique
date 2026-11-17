import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { dayBounds, fmtLongDate, todayIn } from "@/lib/time";
import { AppointmentTable, apptInclude } from "@/components/appointment-table";
import { FilterSelect } from "@/components/date-nav";
import { AutoRefresh } from "@/components/nav-client";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { Scanner } from "./scanner";
import { WalkIn } from "./walk-in";

export const dynamic = "force-dynamic";

export default async function Reception({ searchParams }: { searchParams: Promise<{ officer?: string }> }) {
  const user = await requirePageUser("RECEPTIONIST", "ADMIN");
  const { officer } = await searchParams;
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const { start, end } = dayBounds(today, tz);
  const [rows, officers] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: user.organizationId, startAt: { gte: start, lt: end }, officerId: officer || undefined },
      include: apptInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.officerProfile.findMany({
      where: { organizationId: user.organizationId, user: { isActive: true } },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const c = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader title="Reception desk" description={`${fmtLongDate(new Date(), tz)} · scan QR tokens, check visitors in, register walk-ins`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Scanner />
        <WalkIn officers={officers.map((o) => ({ id: o.id, name: `${o.user.name} — ${o.designation}` }))} today={today} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Expected" value={c(["BOOKED"])} tone="text-sky-600" />
        <Stat label="Checked-in" value={c(["CHECKED_IN"])} tone="text-violet-600" />
        <Stat label="Waiting" value={c(["WAITING"])} tone="text-amber-600" />
        <Stat label="In meeting" value={c(["IN_PROGRESS"])} tone="text-emerald-600" />
        <Stat label="Completed" value={c(["COMPLETED"])} />
      </div>

      <Card>
        <CardHeader
          title="Today's queue"
          description="Updates every 15 seconds"
          action={<FilterSelect name="officer" value={officer ?? ""} all="All officers" options={officers.map((o) => ({ value: o.id, label: o.user.name }))} />}
        />
        <AppointmentTable rows={rows} tz={tz} role={user.role} empty="No appointments today" />
      </Card>
    </div>
  );
}
