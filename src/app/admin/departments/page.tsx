import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DepartmentsManager } from "./departments-manager";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requirePageUser("ADMIN");
  const deps = await prisma.department.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { officers: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Departments" description="Visitors pick a department first, then an officer." />
      <Card>
        <CardHeader title={`${deps.length} department${deps.length === 1 ? "" : "s"}`} />
        <DepartmentsManager deps={deps.map((d) => ({ id: d.id, name: d.name, description: d.description, officers: d._count.officers }))} />
      </Card>
    </div>
  );
}
