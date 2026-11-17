import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { fmtDate, fmtRange, todayIn } from "@/lib/time";
import { ResponseBadge } from "@/components/appointment-table";
import { AutoRefresh } from "@/components/nav-client";
import { Card, CardHeader, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { SummonForm, type Person } from "./summon-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Call immediate meeting" };

/** Designated officers (canSummon) call anyone in the organization for a meeting right now */
export default async function SummonPage() {
  const user = await requirePageUser("OFFICER");
  if (!user.canSummon) redirect("/officer");
  const tz = user.org.timezone;

  const [people, me, recent] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, NOT: { id: user.id } },
      select: { id: true, name: true, role: true, employeeId: true, jobTitle: true, department: { select: { name: true } }, officerProfile: { select: { designation: true, department: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.officerProfile.findUniqueOrThrow({ where: { id: user.officerId! } }),
    prisma.appointment.findMany({
      where: { requestedById: user.id, kind: "IMMEDIATE" },
      include: { visitor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const list: Person[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.officerProfile?.designation ?? p.jobTitle ?? (p.role === "RECEPTIONIST" ? "Reception" : p.role === "ADMIN" ? "Administration" : "Staff"),
    department: p.officerProfile?.department?.name ?? p.department?.name ?? null,
    employeeId: p.employeeId,
  }));

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader title="Call an immediate meeting" description="Pick one or more people. They get an urgent alert on their screen and phone and must acknowledge it. Working hours and slot rules don't apply." />
      <SummonForm people={list} defaultDuration={me.slotDurationMin} today={todayIn(tz)} location={me.location} />
      <Card>
        <CardHeader title="Meetings you called" description="Live: see who has acknowledged" />
        {recent.length ? (
          <ul className="divide-y divide-rule">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium text-ink">{a.visitor.name}</div>
                  <div className="text-muted">{fmtDate(a.startAt, tz)}, {fmtRange(a.startAt, a.endAt, tz)}{a.purpose ? `. “${a.purpose}”` : ""}</div>
                </div>
                <div className="flex items-center gap-2"><ResponseBadge r={a} /><StatusBadge status={a.status} /></div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="You haven't called any meetings yet" />
        )}
      </Card>
    </div>
  );
}
