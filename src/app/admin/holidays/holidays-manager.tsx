"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input, Empty } from "@/components/ui";

export function HolidaysManager({ rows }: { rows: { id: string; name: string; label: string }[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      {rows.length ? (
        <ul className="divide-y divide-rule">
          {rows.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><span className="font-medium">{h.label}</span> <span className="text-muted">{h.name}</span></span>
              <button className="text-xs font-medium text-muted hover:text-error" onClick={async () => { await api(`/api/holidays/${h.id}`, { method: "DELETE" }); router.refresh(); }}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No upcoming holidays" />
      )}
      <form
        className="grid gap-3 border-t border-rule p-5 sm:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setErr(null);
          try {
            await api("/api/holidays", { body: formData(form) });
            form.reset();
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        {err && <div className="sm:col-span-4"><Alert>{err}</Alert></div>}
        <Field label="Date"><Input type="date" name="date" required /></Field>
        <Field label="Until (optional)" hint="For multi-day breaks"><Input type="date" name="endDate" /></Field>
        <Field label="Name"><Input name="name" required placeholder="e.g. Diwali" /></Field>
        <Button className="self-end">Add holiday</Button>
      </form>
    </div>
  );
}
