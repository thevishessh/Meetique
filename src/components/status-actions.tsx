"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { api } from "./client-api";
import { Button, type ButtonProps } from "./ui";

const LABEL: Partial<Record<AppointmentStatus, string>> = {
  CHECKED_IN: "Check in",
  WAITING: "Send to waiting",
  IN_PROGRESS: "Start meeting",
  COMPLETED: "Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "No show",
};
const VARIANT: Partial<Record<AppointmentStatus, ButtonProps["variant"]>> = {
  CHECKED_IN: "primary",
  WAITING: "secondary",
  IN_PROGRESS: "success",
  COMPLETED: "primary",
  CANCELLED: "danger",
  NO_SHOW: "secondary",
};

export function StatusActions({ id, actions, size = "sm" }: { id: string; actions: AppointmentStatus[]; size?: "sm" | "md" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((s) => (
          <Button
            key={s}
            size={size}
            variant={VARIANT[s]}
            disabled={!!busy}
            onClick={async () => {
              if (s === "CANCELLED" && !confirm("Cancel this appointment? The slot will be released.")) return;
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
            {busy === s ? "…" : LABEL[s]}
          </Button>
        ))}
      </div>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
