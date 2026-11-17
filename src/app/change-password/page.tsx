import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { AuthLayout } from "@/components/auth-layout";
import { ForceChangeForm } from "@/components/auth-forms";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

/** Shown after sign-in when the account still has a temporary password */
export default async function ChangePasswordPage() {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!u.mustChangePassword) redirect(homeFor(u.role));
  return (
    <AuthLayout
      title="Set your own password"
      lead={<>Hello {u.name}. You signed in with a temporary password. Choose your own before you carry on.</>}
      foot={<Link href="/login" className="link">Use a different account</Link>}
    >
      <h2 className="text-section text-ink">New password</h2>
      <ForceChangeForm home={homeFor(u.role)} />
    </AuthLayout>
  );
}
