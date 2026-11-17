"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client-api";
import { Button, Textarea } from "./ui";

/** Officer writes meeting notes / decisions (visible to the attendee in "My meetings") */
export function NotesEditor({ id, initial }: { id: string; initial: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand-700 hover:underline">
        {initial ? "Edit notes" : "+ Add notes"}
      </button>
    );
  return (
    <div className="mt-2 w-full space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Discussion points, decisions, follow-ups…" />
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await api(`/api/appointments/${id}/notes`, { method: "PUT", body: { notes: text } });
              setOpen(false);
              router.refresh();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save notes"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setText(initial ?? ""); setOpen(false); }}>Cancel</Button>
      </div>
    </div>
  );
}
