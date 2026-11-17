import { requirePageUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";
import { PhoneAlertsCard } from "@/components/push-client";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requirePageUser();
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="My account" description={`${user.name} · ${user.email}${user.employeeId ? ` · L Code ${user.employeeId}` : ""}`} />
      <PhoneAlertsCard />
      <Card>
        <CardHeader title="Change password" description="At least 8 characters, with a letter and a number." />
        <PasswordForm />
      </Card>
    </div>
  );
}
