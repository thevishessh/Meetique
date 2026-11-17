import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password" lead="We’ll email you a link to set a new one. It works once, for 30 minutes." foot={<Link href="/login" className="link">Back to sign in</Link>}>
      <h2 className="text-section text-ink">Your campus email</h2>
      <ForgotForm />
    </AuthLayout>
  );
}
