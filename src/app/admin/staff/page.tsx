import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await requirePageUser("ADMIN");
  const staff = await prisma.user.findMany({
    where: { organizationId: user.organizationId, role: { in: ["ADMIN", "RECEPTIONIST"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Organization admins and reception / token operators. Officers are managed on the Officers page." />
      <Card>
        <CardHeader title="Admins & receptionists" />
        <StaffManager staff={staff} me={user.id} />
      </Card>
    </div>
  );
}
