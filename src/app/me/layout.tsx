import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell user={user}>{children}</AppShell>;
}
