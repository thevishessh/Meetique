import FindForm from "./find-form";
import { Card } from "@/components/ui";

export const metadata = { title: "Find my booking" };

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Find my booking</h1>
      <p className="mt-1 text-sm text-slate-500">Enter your token number and the mobile number you booked with to view, reschedule or cancel.</p>
      <Card className="mt-6 p-6"><FindForm org={slug} /></Card>
    </div>
  );
}
