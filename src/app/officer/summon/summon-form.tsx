"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-api";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea, cx } from "@/components/ui";

export type Person = { id: string; name: string; title: string; department: string | null; employeeId: string | null };

export function SummonForm({ people, defaultDuration, today, location }: { people: Person[]; defaultDuration: number; today: string; location: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Person | null>(null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState<{ tone: "green" | "rose" | "amber"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? people.filter((p) => [p.name, p.title, p.department, p.employeeId].some((v) => v?.toLowerCase().includes(s))) : people;
    return list.slice(0, 40);
  }, [q, people]);

  return (
    <Card>
      <CardHeader title="New immediate meeting" description={location ? `Meeting place: ${location}` : undefined} />
      <form
        className="grid gap-5 p-5 lg:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!pick) return setMsg({ tone: "rose", text: "Choose who you want to call" });
          if (mode === "later" && !time) return setMsg({ tone: "rose", text: "Pick a time" });
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ tokenNumber: string; overlaps: number; attendee: string }>("/api/summons", {
              body: { targetUserId: pick.id, when: mode === "now" ? "now" : `${date}T${time}`, durationMin: Number(f.get("durationMin")), purpose: f.get("purpose") },
            });
            setMsg({
              tone: r.overlaps ? "amber" : "green",
              text: `${r.attendee} has been alerted (token ${r.tokenNumber}).${r.overlaps ? ` Note: this overlaps ${r.overlaps} meeting(s) already in your queue.` : ""}`,
            });
            setPick(null);
            setQ("");
            (e.target as HTMLFormElement).reset();
            router.refresh();
          } catch (err) {
            setMsg({ tone: "rose", text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {msg && <div className="lg:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

        <div>
          <Field label="Who do you want to meet?">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, designation, department or employee ID" />
          </Field>
          <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPick(p)}
                  className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm", pick?.id === p.id ? "bg-brand-50" : "hover:bg-slate-50")}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">{[p.title, p.department, p.employeeId && `ID ${p.employeeId}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {pick?.id === p.id && <span className="text-xs font-semibold text-brand-700">Selected ✓</span>}
                </button>
              </li>
            ))}
            {!matches.length && <li className="px-3 py-4 text-center text-sm text-slate-500">No one matches “{q}”</li>}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">{pick ? <>Calling <b>{pick.name}</b> — {pick.title}</> : <span className="text-slate-500">Nobody selected yet</span>}</div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">When</span>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "now" ? "primary" : "secondary"} onClick={() => setMode("now")}>Right now</Button>
              <Button type="button" variant={mode === "later" ? "primary" : "secondary"} onClick={() => setMode("later")}>At a set time</Button>
            </div>
            {mode === "later" && (
              <div className="mt-2 flex gap-2">
                <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="w-44" />
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
              </div>
            )}
          </div>
          <Field label="Duration">
            <Select name="durationMin" defaultValue={[10, 15, 20, 30, 45, 60, 90, 120].includes(defaultDuration) ? defaultDuration : 30}>
              {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Purpose"><Textarea name="purpose" rows={3} required minLength={2} maxLength={300} placeholder="e.g. Urgent: NAAC documentation review" /></Field>
          <Button variant="danger" size="lg" className="w-full !bg-rose-600 !text-white hover:!bg-rose-700" disabled={busy || !pick}>{busy ? "Calling…" : "Call meeting now"}</Button>
        </div>
      </form>
    </Card>
  );
}
