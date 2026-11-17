"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";

type S = { id: string; name: string; email: string; role: "ADMIN" | "OFFICER" | "RECEPTIONIST" | "STAFF"; isActive: boolean; employeeId?: string | null; jobTitle?: string | null; department?: { name: string } | null };
const ROLE: Record<S["role"], { label: string; tone: "brand" | "slate" | "green" }> = {
  ADMIN: { label: "Admin", tone: "brand" },
  RECEPTIONIST: { label: "Receptionist", tone: "slate" },
  STAFF: { label: "Staff", tone: "green" },
  OFFICER: { label: "Officer", tone: "brand" },
};

export function StaffManager({ staff, me, departments }: { staff: S[]; me: string; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("STAFF");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? staff.filter((x) => [x.name, x.email, x.employeeId, x.jobTitle, x.department?.name].some((v) => v?.toLowerCase().includes(s))) : staff;
  }, [q, staff]);
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
      <div className="px-5 pt-4"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, L Code, department…" className="max-w-md" /></div>
      <ul className="mt-2 max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
        {shown.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="font-medium">{s.name} {s.id === me && <span className="text-xs text-slate-400">(you)</span>}</div>
              <div className="text-xs text-slate-500">{[s.email, s.jobTitle, s.department?.name, s.employeeId ? `L Code ${s.employeeId}` : "⚠ no L Code"].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ROLE[s.role].tone}>{ROLE[s.role].label}</Badge>
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
        {!shown.length && <li className="px-5 py-6 text-center text-sm text-slate-500">No match</li>}
      </ul>
      <form
        className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = formData(form);
          run(async () => { await api("/api/staff", { body: f }); form.reset(); setRole("STAFF"); }, "Account created.");
        }}
      >
        <div className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-4">Add one account</div>
        <Field label="Role">
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="STAFF">Staff member (books meetings)</option>
            <option value="RECEPTIONIST">Receptionist / token operator</option>
            <option value="ADMIN">Organization admin</option>
          </Select>
        </Field>
        <Field label="Name"><Input name="name" required /></Field>
        <Field label="Email"><Input name="email" type="email" required /></Field>
        <Field label="Temporary password"><Input name="password" required minLength={8} /></Field>
        <Field label="L Code" hint="Compulsory"><Input name="employeeId" required pattern="[A-Za-z0-9][A-Za-z0-9-]{1,19}" placeholder="L12345" className="uppercase" /></Field>
        {role === "STAFF" && (
          <>
            <Field label="Designation"><Input name="jobTitle" placeholder="Assistant Professor" /></Field>
            <Field label="Department">
              <Select name="departmentId" defaultValue="">
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Mobile"><Input name="phone" /></Field>
          </>
        )}
        <Button className="self-end">Add account</Button>
      </form>
    </div>
  );
}

export function StaffImport() {
  const router = useRouter();
  const [res, setRes] = useState<{ tone: "green" | "rose" | "amber"; text: string; skipped?: { line: number; reason: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setRes(null);
        try {
          const r = await api<{ created: number; skipped: { line: number; reason: string }[] }>("/api/staff/import", { body: formData(form) });
          setRes({ tone: r.skipped.length ? "amber" : "green", text: `${r.created} staff account(s) created${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}.`, skipped: r.skipped });
          if (r.created) form.reset();
          router.refresh();
        } catch (err) {
          setRes({ tone: "rose", text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      {res && (
        <Alert tone={res.tone}>
          {res.text}
          {!!res.skipped?.length && <ul className="mt-1 list-disc pl-5 text-xs">{res.skipped.slice(0, 20).map((s) => <li key={s.line}>Line {s.line}: {s.reason}</li>)}</ul>}
        </Alert>
      )}
      <Textarea name="csv" rows={6} required className="font-mono text-xs" placeholder={"name,email,lCode,department,designation,phone\nDr. Asha Rao,asha.rao@campus.edu,L10234,Computer Science,Assistant Professor,9876500001"} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Initial password for everyone"><Input name="password" required minLength={8} className="w-56" /></Field>
        <Button disabled={busy}>{busy ? "Importing…" : "Import staff"}</Button>
      </div>
    </form>
  );
}
