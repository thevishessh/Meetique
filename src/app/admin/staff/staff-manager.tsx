"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Badge, Button, Field, Input, Select } from "@/components/ui";

type S = { id: string; name: string; email: string; role: "ADMIN" | "OFFICER" | "RECEPTIONIST"; isActive: boolean };

export function StaffManager({ staff, me }: { staff: S[]; me: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "green", text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    }
  };
  return (
    <div>
      {msg && <div className="px-5 pt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <ul className="divide-y divide-slate-100">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <div className="font-medium">{s.name} {s.id === me && <span className="text-xs text-slate-400">(you)</span>}</div>
              <div className="text-xs text-slate-500">{s.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={s.role === "ADMIN" ? "brand" : "slate"}>{s.role === "ADMIN" ? "Admin" : "Receptionist"}</Badge>
              {!s.isActive && <Badge tone="rose">Deactivated</Badge>}
              <Button size="sm" variant="secondary" onClick={() => { const pw = prompt(`New password for ${s.name} (min 8 characters):`); if (pw) run(() => api(`/api/staff/${s.id}`, { method: "PATCH", body: { password: pw } }), "Password updated."); }}>Reset password</Button>
              {s.id !== me && (
                <Button size="sm" variant={s.isActive ? "danger" : "success"} onClick={() => run(() => api(`/api/staff/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } }), s.isActive ? "Deactivated." : "Re-activated.")}>
                  {s.isActive ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = formData(form);
          run(async () => { await api("/api/staff", { body: f }); form.reset(); }, "Staff account created.");
        }}
      >
        <Field label="Name"><Input name="name" required /></Field>
        <Field label="Email"><Input name="email" type="email" required /></Field>
        <Field label="Temporary password"><Input name="password" required minLength={8} /></Field>
        <Field label="Role">
          <Select name="role" defaultValue="RECEPTIONIST">
            <option value="RECEPTIONIST">Receptionist / token operator</option>
            <option value="ADMIN">Organization admin</option>
          </Select>
        </Field>
        <Button className="self-end">Add staff</Button>
      </form>
    </div>
  );
}
