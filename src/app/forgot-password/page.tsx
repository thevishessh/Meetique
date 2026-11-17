import Link from "next/link";
import { Card, Logo } from "@/components/ui";
import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/login"><Logo className="text-xl" /></Link>
      <Card className="mt-8 w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-500">We'll email you a link to set a new password.</p>
        <ForgotForm />
      </Card>
      <p className="mt-6 text-sm text-slate-500"><Link href="/login" className="font-medium text-brand-600 hover:underline">← Back to sign in</Link></p>
    </div>
  );
}
