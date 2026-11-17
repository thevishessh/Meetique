import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthLayout title="Set a new password" lead="At least 8 characters, with a letter and a number." foot={<Link href="/login" className="link">Back to sign in</Link>}>
      <h2 className="text-section text-ink">New password</h2>
      <ResetForm token={token} />
    </AuthLayout>
  );
}
