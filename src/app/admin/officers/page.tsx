import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { CreateOfficerForm } from "./create-officer-form";

export const dynamic = "force-dynamic";
const WD = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function OfficersPage() {
  const user = await requirePageUser("ADMIN");
  const [officers, departments] = await Promise.all([
    prisma.officerProfile.findMany({
      where: { organizationId: user.organizationId },
      include: { user: { select: { name: true, email: true, isActive: true } }, department: true, workingHours: { orderBy: { weekday: "asc" } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Officers" description="Appointment hosts. Each officer has their own availability and slots." />
      <Card>
        <CardHeader title={`${officers.length} officer${officers.length === 1 ? "" : "s"}`} />
        {officers.length ? (
          <ul className="divide-y divide-slate-100">
            {officers.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/officers/${o.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{o.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{o.user.name} <span className="font-normal text-slate-500">· {o.designation}</span></div>
                    <div className="text-xs text-slate-500">{o.department?.name ?? "No department"} · {o.user.email}</div>
                  </div>
                  <div className="text-xs text-slate-500">{o.workingHours.length ? o.workingHours.map((h) => WD[h.weekday]).join(", ") : "No hours set"} · {o.slotDurationMin}m slots</div>
                  {!o.user.isActive ? <Badge tone="rose">Deactivated</Badge> : o.isBookable ? <Badge tone="green">Bookable</Badge> : <Badge tone="amber">Paused</Badge>}
                  <span className="text-sm text-brand-600">Manage →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><Empty title="No officers yet">Add your first officer below.</Empty></div>
        )}
      </Card>
      <Card>
        <CardHeader title="Add officer" description="Creates a login for the officer with default hours Mon–Sat 10:00–14:00 (break 12:00–12:30). They can change it later." />
        <CreateOfficerForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </Card>
    </div>
  );
}
