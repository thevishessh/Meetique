import { redirect } from "next/navigation";
import { homeFor, requirePageUser } from "@/lib/auth";

export default async function Dashboard() {
  const u = await requirePageUser();
  redirect(homeFor(u.role));
}
