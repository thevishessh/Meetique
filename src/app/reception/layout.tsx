import { redirect } from "next/navigation";
import { canUseReception, homeFor, requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (!canUseReception(user)) redirect(homeFor(user.role));
  return <AppShell user={user}>{children}</AppShell>;
}
