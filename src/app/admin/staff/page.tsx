import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StaffManager, StaffImport } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await requirePageUser("ADMIN");
  const [staff, departments] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId, role: { in: ["ADMIN", "RECEPTIONIST", "STAFF"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, isActive: true, employeeId: true, jobTitle: true, department: { select: { name: true } } },
    }),
    prisma.department.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Everyone who can sign in: staff members (book meetings), receptionists and admins. Officers are managed on the Officers page." />
      <Card>
        <CardHeader title={`${staff.length} accounts`} />
        <StaffManager staff={staff} me={user.id} departments={departments} />
      </Card>
      <Card>
        <CardHeader title="Bulk import staff (CSV)" description="Paste from Excel/CSV — one person per line: name, email, L Code (compulsory), department, designation, phone. Missing departments are created. Everyone must set their own password at first sign-in." />
        <StaffImport />
      </Card>
    </div>
  );
}
