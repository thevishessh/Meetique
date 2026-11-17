import { requirePageUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requirePageUser();
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="My account" description={`${user.name} · ${user.email}`} />
      <Card>
        <CardHeader title="Change password" description="Please change the temporary password you were given." />
        <PasswordForm />
      </Card>
    </div>
  );
}
