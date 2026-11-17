"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { Button, Input } from "./ui";

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const go = (d: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("date", d);
    router.push(`${path}?${q}`);
  };
  const shift = (n: number) => go(DateTime.fromISO(date).plus({ days: n }).toFormat("yyyy-MM-dd"));
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Previous day" type="button"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></Button>
      <Input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} className="h-8 w-40" />
      <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label="Next day" type="button"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></Button>
      {date !== today && <Button variant="ghost" size="sm" onClick={() => go(today)}>Today</Button>}
    </div>
  );
}

export function FilterSelect({ name, value, options, all }: { name: string; value: string; options: { value: string; label: string }[]; all: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select
      value={value}
      onChange={(e) => {
        const q = new URLSearchParams(sp.toString());
        if (e.target.value) q.set(name, e.target.value);
        else q.delete(name);
        router.push(`${path}?${q}`);
      }}
      className="h-8 rounded-lg border-0 bg-paper px-2 pr-8 text-sm ring-1 ring-inset ring-rule focus:ring-2 focus:ring-ink"
    >
      <option value="">{all}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
