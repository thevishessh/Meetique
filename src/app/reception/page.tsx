import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { canUseReception, homeFor, receptionScope, requirePageUser } from "@/lib/auth";
import { dayBounds, fmtLongDate, todayIn } from "@/lib/time";
import { AppointmentTable, apptInclude } from "@/components/appointment-table";
import { FilterSelect } from "@/components/date-nav";
import { AutoRefresh } from "@/components/nav-client";
import { Card, CardHeader, PageHeader, Stat, Stats } from "@/components/ui";
import { Scanner } from "./scanner";
import { WalkIn } from "./walk-in";

export const dynamic = "force-dynamic";

export default async function Reception({ searchParams }: { searchParams: Promise<{ officer?: string }> }) {
  const user = await requirePageUser();
  if (!canUseReception(user)) redirect(homeFor(user.role));
  // A PA only ever sees their own officer; admins / receptionists can filter
  const scope = receptionScope(user);
  const officer = scope ?? (await searchParams).officer;
  const tz = user.org.timezone;
  const today = todayIn(tz);
  const { start, end } = dayBounds(today, tz);
  const [rows, officers, org] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: user.organizationId, startAt: { gte: start, lt: end }, officerId: officer || undefined },
      include: apptInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.officerProfile.findMany({
      where: { organizationId: user.organizationId, user: { isActive: true }, ...(scope ? { id: scope } : {}) },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { visitorCategories: true, referenceLabel: true } }),
  ]);
  const c = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader
        title={user.pa ? `Reception for ${user.pa.officerName}` : "Reception desk"}
        description={`${fmtLongDate(new Date(), tz)}. ${user.pa ? "As the PA you check in this officer’s visitors and register walk-ins." : "Scan QR tokens, check visitors in, register walk-ins."}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Scanner />
        <WalkIn officers={officers.map((o) => ({ id: o.id, name: `${o.user.name}, ${o.designation}` }))} today={today} fields={org} defaultOfficerId={scope ?? undefined} />
      </div>

      <Stats>
        <Stat label="Expected" value={c(["BOOKED"])} />
        <Stat label="Checked-in" value={c(["CHECKED_IN"])} />
        <Stat label="Waiting" value={c(["WAITING"])} tone="in" />
        <Stat label="In meeting" value={c(["IN_PROGRESS"])} />
        <Stat label="Completed" value={c(["COMPLETED"])} />
      </Stats>

      <Card>
        <CardHeader
          title="Today's queue"
          description="Updates every 15 seconds"
          action={scope ? undefined : <FilterSelect name="officer" value={officer ?? ""} all="All officers" options={officers.map((o) => ({ value: o.id, label: o.user.name }))} />}
        />
        <AppointmentTable rows={rows} tz={tz} role={user.pa ? "RECEPTIONIST" : user.role} showOfficer={!scope} empty="No appointments today" />
      </Card>
    </div>
  );
}
