import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("OFFICER");
  return <AppShell user={user}>{children}</AppShell>;
}
