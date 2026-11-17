"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-api";
import { Alert, Button, Card, CardHeader, Select } from "@/components/ui";

type P = { id: string; name: string; detail: string };

/** Admin assigns staff members as this officer's personal assistant(s) */
export function PaManager({ officerId, officerName, current, candidates }: { officerId: string; officerName: string; current: P[]; candidates: P[] }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<{ tone: "green" | "rose"; text: string } | null>(null);
  const set = async (userId: string, paOfficerId: string | null, ok: string) => {
    setMsg(null);
    try {
      await api(`/api/staff/${userId}`, { method: "PATCH", body: { paOfficerId } });
      setMsg({ tone: "green", text: ok });
      setPick("");
      router.refresh();
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    }
  };
  return (
    <Card>
      <CardHeader title="Personal assistant (PA)" description={`A PA signs in with their own ID and gets the Reception desk for ${officerName} only: scan QR, check in, waiting, walk-ins.`} />
      <div className="space-y-3 p-5">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {current.length ? (
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {current.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span><b>{p.name}</b> <span className="text-slate-500">{p.detail}</span></span>
                <Button size="sm" variant="danger" onClick={() => set(p.id, null, `${p.name} is no longer PA.`)}>Remove</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No PA assigned.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-sm">
            <option value="">Choose a staff member…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.detail ? ` (${c.detail})` : ""}</option>)}
          </Select>
          <Button disabled={!pick} onClick={() => set(pick, officerId, "PA assigned. They will see the Reception desk at their next page load.")}>Make PA</Button>
        </div>
        <p className="text-xs text-slate-500">Only staff accounts can be a PA. Add the person first under Admin → Staff if needed. A person can be PA to one officer at a time.</p>
      </div>
    </Card>
  );
}
