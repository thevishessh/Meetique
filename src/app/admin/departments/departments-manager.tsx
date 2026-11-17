"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, formData } from "@/components/client-api";
import { Alert, Button, Input } from "@/components/ui";

type D = { id: string; name: string; description: string | null; officers: number };

export function DepartmentsManager({ deps }: { deps: D[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      setEditing(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div>
      {err && <div className="px-5 pt-4"><Alert>{err}</Alert></div>}
      <ul className="divide-y divide-rule">
        {deps.map((d) =>
          editing === d.id ? (
            <li key={d.id} className="px-5 py-3">
              <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const f = formData(e.currentTarget); run(() => api(`/api/departments/${d.id}`, { method: "PATCH", body: f })); }}>
                <Input name="name" defaultValue={d.name} required className="max-w-xs" />
                <Input name="description" defaultValue={d.description ?? ""} placeholder="Description" className="max-w-md" />
                <Button size="md">Save</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </form>
            </li>
          ) : (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-muted">{d.officers} officer{d.officers === 1 ? "" : "s"}{d.description ? `. ${d.description}` : ""}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(d.id)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => confirm(`Delete "${d.name}"? Officers stay, without a department.`) && run(() => api(`/api/departments/${d.id}`, { method: "DELETE" }))}>Delete</Button>
              </div>
            </li>
          ),
        )}
      </ul>
      <form
        className="flex flex-wrap gap-2 border-t border-rule p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = formData(form);
          run(async () => {
            await api("/api/departments", { body: f });
            form.reset();
          });
        }}
      >
        <Input name="name" required placeholder="New department, e.g. Registrar Office" className="max-w-xs" />
        <Input name="description" placeholder="Description (optional)" className="max-w-md" />
        <Button>Add department</Button>
      </form>
    </div>
  );
}
