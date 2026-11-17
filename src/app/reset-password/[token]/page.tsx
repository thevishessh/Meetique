import Link from "next/link";
import { Card, Logo } from "@/components/ui";
import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/login"><Logo className="text-xl" /></Link>
      <Card className="mt-8 w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <ResetForm token={token} />
      </Card>
    </div>
  );
}
