import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { Card, Logo } from "@/components/ui";
import { ForceChangeForm } from "@/components/auth-forms";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

/** Shown after sign-in when the account still has a temporary password */
export default async function ChangePasswordPage() {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!u.mustChangePassword) redirect(homeFor(u.role));
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo className="text-xl" />
      <Card className="mt-8 w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Set your own password</h1>
        <p className="mt-1 text-sm text-slate-500">Hello {u.name}. You signed in with a temporary password — please choose a new one before continuing.</p>
        <ForceChangeForm home={homeFor(u.role)} />
      </Card>
      <p className="mt-6 text-sm text-slate-500"><Link href="/login" className="hover:underline">Use a different account</Link></p>
    </div>
  );
}
