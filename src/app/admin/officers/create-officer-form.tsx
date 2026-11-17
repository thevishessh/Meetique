"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function CreateOfficerForm({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ id: string }>("/api/officers", { body: formData(form) });
          form.reset();
          router.push(`/admin/officers/${r.id}`);
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {err && <div className="sm:col-span-2 lg:col-span-3"><Alert>{err}</Alert></div>}
      <Field label="Full name"><Input name="name" required /></Field>
      <Field label="Designation"><Input name="designation" required placeholder="Registrar" /></Field>
      <Field label="Department">
        <Select name="departmentId" defaultValue="">
          <option value="">— None —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field label="Login email"><Input name="email" type="email" required /></Field>
      <Field label="Temporary password" hint="Min 8 characters"><Input name="password" type="text" required minLength={8} /></Field>
      <Field label="Room / location (optional)"><Input name="location" placeholder="Admin Block, Room 104" /></Field>
      <div className="sm:col-span-2 lg:col-span-3"><Button disabled={busy}>{busy ? "Adding…" : "Add officer"}</Button></div>
    </form>
  );
}
