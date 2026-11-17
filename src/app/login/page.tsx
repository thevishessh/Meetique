import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { AuthLayout } from "@/components/auth-layout";
import { ALLOW_ORG_SIGNUP, PUBLIC_BOOKING } from "@/lib/config";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(homeFor(u.role));
  return (
    <AuthLayout
      title="Staff sign in"
      lead={PUBLIC_BOOKING ? "Admins, officers and reception staff." : "Book a meeting with an officer, answer a call to a meeting, or run your desk."}
      foot={
        ALLOW_ORG_SIGNUP ? (
          <>New organization? <Link className="link" href="/register">Register it</Link></>
        ) : !PUBLIC_BOOKING ? (
          <Link className="link" href="/forgot-password">Forgot your password?</Link>
        ) : (
          <Link className="link" href="/">Back to appointment booking</Link>
        )
      }
    >
      <h2 className="text-section text-ink">Sign in with your campus email</h2>
      <LoginForm />
    </AuthLayout>
  );
}
