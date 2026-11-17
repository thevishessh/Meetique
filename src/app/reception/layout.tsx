import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("RECEPTIONIST", "ADMIN");
  return <AppShell user={user}>{children}</AppShell>;
}
