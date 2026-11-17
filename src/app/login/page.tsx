import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { Card, Logo } from "@/components/ui";
import { ALLOW_ORG_SIGNUP, PUBLIC_BOOKING } from "@/lib/config";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(homeFor(u.role));
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/"><Logo className="text-xl" /></Link>
      <Card className="mt-8 w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-slate-500">{PUBLIC_BOOKING ? "Admins, officers and reception staff." : "All university staff — sign in to book or attend meetings."}</p>
        <LoginForm />
      </Card>
      {ALLOW_ORG_SIGNUP ? (
        <p className="mt-6 text-sm text-slate-500">
          New organization? <Link className="font-medium text-brand-600 hover:underline" href="/register">Register here</Link>
        </p>
      ) : !PUBLIC_BOOKING ? (
        <p className="mt-6 text-sm text-slate-500"><Link className="font-medium text-brand-600 hover:underline" href="/forgot-password">Forgot password?</Link></p>
      ) : (
        <p className="mt-6 text-sm text-slate-500"><Link className="font-medium text-brand-600 hover:underline" href="/">← Back to appointment booking</Link></p>
      )}
    </div>
  );
}
