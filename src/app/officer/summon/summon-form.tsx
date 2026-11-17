"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-api";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea, cx } from "@/components/ui";

export type Person = { id: string; name: string; title: string; department: string | null; employeeId: string | null };
type Busy = { userId: string; name: string; items: string[] };

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export function SummonForm({ people, defaultDuration, today, location }: { people: Person[]; defaultDuration: number; today: string; location: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(DURATIONS.includes(defaultDuration) ? defaultDuration : 30);
  const [busy, setBusyList] = useState<Busy[]>([]);
  const [msg, setMsg] = useState<{ tone: "green" | "rose" | "amber"; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? people.filter((p) => [p.name, p.title, p.department, p.employeeId].some((v) => v?.toLowerCase().includes(s))) : people;
    return list.slice(0, 50);
  }, [q, people]);

  const when = mode === "now" ? "now" : time ? `${date}T${time}` : "";
  const ids = picked.map((p) => p.id).join(",");

  // Live "is anyone busy then?" check
  useEffect(() => {
    if (!ids || !when) return setBusyList([]);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ busy: Busy[] }>(`/api/summons/conflicts?${new URLSearchParams({ ids, when, duration: String(duration) })}`);
        setBusyList(r.busy);
      } catch {
        setBusyList([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [ids, when, duration]);

  const toggle = (p: Person) => setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]));

  return (
    <Card>
      <CardHeader title="New immediate meeting" description={location ? `Meeting place: ${location}` : undefined} />
      <form
        className="grid gap-5 p-5 lg:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!picked.length) return setMsg({ tone: "rose", text: "Choose who you want to call" });
          if (!when) return setMsg({ tone: "rose", text: "Pick a time" });
          if (busy.length && !confirm(`${busy.map((b) => b.name).join(", ")} ${busy.length === 1 ? "is" : "are"} already busy at that time. Call anyway?`)) return;
          const f = new FormData(e.currentTarget);
          setSending(true);
          setMsg(null);
          try {
            const r = await api<{ created: number; tokens: string[]; attendees: string[]; overlaps: number }>("/api/summons", {
              body: { targetUserIds: picked.map((p) => p.id), when, durationMin: duration, purpose: f.get("purpose") },
            });
            setMsg({
              tone: r.overlaps ? "amber" : "green",
              text: `${r.attendees.join(", ")} ${r.created === 1 ? "has" : "have"} been alerted on their screen and phone.${r.overlaps ? ` Note: this overlaps ${r.overlaps} meeting(s) already in your queue.` : ""}`,
            });
            setPicked([]);
            setQ("");
            (e.target as HTMLFormElement).reset();
            router.refresh();
          } catch (err) {
            setMsg({ tone: "rose", text: (err as Error).message });
          } finally {
            setSending(false);
          }
        }}
      >
        {msg && <div className="lg:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

        <div>
          <Field label="Who do you want to meet? (select one or more)">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, designation, department or L Code" />
          </Field>
          <ul className="mt-2 max-h-80 divide-y divide-rule overflow-y-auto rounded-lg ring-1 ring-rule">
            {matches.map((p) => {
              const on = picked.some((x) => x.id === p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p)} className={cx("flex w-full items-center gap-3 px-3 py-2 text-left text-sm", on ? "bg-accent-soft" : "hover:bg-paper-2")}>
                    <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]", on ? "border-ink bg-ink text-paper" : "border-rule")}>{on ? "✓" : ""}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{[p.title, p.department, p.employeeId && `L Code ${p.employeeId}`].filter(Boolean).join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!matches.length && <li className="px-3 py-4 text-center text-sm text-muted">No one matches “{q}”</li>}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-paper-2 px-4 py-3 text-sm">
            {picked.length ? (
              <>
                <div className="mb-1 font-medium">Calling {picked.length} {picked.length === 1 ? "person" : "people"}:</div>
                <div className="flex flex-wrap gap-1.5">
                  {picked.map((p) => (
                    <button type="button" key={p.id} onClick={() => toggle(p)} className="rounded-full bg-paper px-2.5 py-1 text-xs ring-1 ring-rule hover:ring-error" title="Remove">
                      {p.name} ✕
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-muted">Nobody selected yet</span>
            )}
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-2">When</span>
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
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          {busy.length > 0 && (
            <Alert tone="amber">
              <b>Already busy at that time:</b>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {busy.map((b) => <li key={b.userId}><b>{b.name}</b>: {b.items.join("; ")}</li>)}
              </ul>
              <span className="text-xs">You can still call them; the alert says it's urgent.</span>
            </Alert>
          )}
          <Field label="Purpose"><Textarea name="purpose" rows={3} required minLength={2} maxLength={300} placeholder="e.g. Urgent: NAAC documentation review" /></Field>
          <Button size="lg" className="w-full" disabled={sending || !picked.length}>
            {sending ? "Calling…" : picked.length > 1 ? `Call ${picked.length} people now` : "Call meeting now"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
