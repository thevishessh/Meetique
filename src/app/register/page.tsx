import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Logo } from "@/components/ui";
import { ALLOW_ORG_SIGNUP, TIMEZONES } from "@/lib/config";
import RegisterForm from "./register-form";

export const metadata = { title: "Register organization" };

export default function RegisterPage() {
  if (!ALLOW_ORG_SIGNUP) notFound();
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12">
      <Link href="/"><Logo className="text-xl" /></Link>
      <Card className="mt-8 w-full max-w-xl p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Register your organization</h1>
        <p className="mt-1 text-sm text-muted">You will become the organization admin. Add departments, officers and reception staff next.</p>
        <RegisterForm timezones={TIMEZONES} />
      </Card>
    </div>
  );
}
