"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { api } from "./client-api";
import { Button, type ButtonProps } from "./ui";

const LABEL: Partial<Record<AppointmentStatus, string>> = {
  BOOKED: "Approve",
  DECLINED: "Decline",
  CHECKED_IN: "Check in",
  WAITING: "Send to waiting",
  IN_PROGRESS: "Start meeting",
  COMPLETED: "Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "No show",
};
/** Quiet rows: the forward step outlined, starting / approving in teal (it means in), stopping steps as ghosts */
const VARIANT: Partial<Record<AppointmentStatus, ButtonProps["variant"]>> = {
  BOOKED: "success",
  DECLINED: "ghost",
  CHECKED_IN: "secondary",
  WAITING: "secondary",
  IN_PROGRESS: "success",
  COMPLETED: "primary",
  CANCELLED: "ghost",
  NO_SHOW: "ghost",
};

export function StatusActions({ id, actions, size = "sm" }: { id: string; actions: AppointmentStatus[]; size?: "sm" | "md" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((s) => (
          <Button
            key={s}
            type="button"
            size={size}
            variant={VARIANT[s]}
            disabled={!!busy}
            onClick={async () => {
              if (s === "CANCELLED" && !confirm("Cancel this appointment? The slot will be released.")) return;
              if (s === "DECLINED" && !confirm("Decline this meeting request? The person will be told.")) return;
              setBusy(s);
              setErr(null);
              try {
                await api(`/api/appointments/${id}/status`, { method: "PATCH", body: { status: s } });
                router.refresh();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === s ? "Saving…" : LABEL[s]}
          </Button>
        ))}
      </div>
      {err && <p role="alert" className="mt-1 text-sm text-error">{err}</p>}
    </div>
  );
}
