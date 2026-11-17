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
      include: { user: { select: { name: true, email: true, isActive: true, employeeId: true } }, department: true, workingHours: { orderBy: { weekday: "asc" } }, assistants: { select: { name: true } } },
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
          <ul className="divide-y divide-rule">
            {officers.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/officers/${o.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-paper-2">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-ink">{o.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{o.user.name} <span className="font-normal text-muted">· {o.designation}</span></div>
                    <div className="text-xs text-muted">{o.department?.name ?? "No department"}, {o.user.email}{o.user.employeeId ? `, L Code ${o.user.employeeId}` : ", no L Code yet"}</div>
                  </div>
                  <div className="text-xs text-muted">{o.workingHours.length ? o.workingHours.map((h) => WD[h.weekday]).join(", ") : "No hours set"}; {o.slotDurationMin} min slots</div>
                  {o.assistants.length > 0 && <Badge tone="slate">PA: {o.assistants.map((a) => a.name).join(", ")}</Badge>}
                  {o.canSummon && <Badge tone="rose">Can call meetings</Badge>}
                  {o.requiresApproval && <Badge tone="amber">Approves bookings</Badge>}
                  {!o.user.isActive ? <Badge tone="rose">Deactivated</Badge> : o.isBookable ? <Badge tone="green">Bookable</Badge> : <Badge tone="amber">Paused</Badge>}
                  <span className="text-sm font-semibold text-ink underline decoration-rule underline-offset-4">Manage</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No officers yet">Add your first officer below.</Empty>
        )}
      </Card>
      <Card>
        <CardHeader title="Add officer" description="Creates a login (they must set their own password at first sign-in) with default hours Monday to Saturday, 10:00 to 14:00 (break 12:00 to 12:30). They can change it later." />
        <CreateOfficerForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </Card>
    </div>
  );
}
