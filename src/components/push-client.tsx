"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./client-api";
import { Alert, Button, Card, CardHeader } from "./ui";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "push-prompt-dismissed";

type PushState = "unsupported" | "blocked" | "off" | "on" | "loading";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID;
const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Shared logic: current state + enable / disable this device */
export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const refresh = useCallback(async () => {
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
    // keep the server in sync (e.g. after the database was reset)
    if (sub && Notification.permission === "granted") void api("/api/push/subscribe", { body: sub.toJSON() }).catch(() => {});
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported()) return setState("unsupported");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
    await api("/api/push/subscribe", { body: sub.toJSON() });
    setState("on");
  }, []);

  const disable = useCallback(async () => {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setState("off");
  }, []);

  return { state, enable, disable };
}

/** Banner on every staff page until phone alerts are on (can be dismissed) */
export function PushPrompt() {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || state !== "off") return null;
  return (
    <div className="no-print well mb-8 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="text-sm text-ink">
        <b>Turn on phone alerts.</b> Hear about it on this phone or computer when an officer calls you or a meeting changes, even with the app closed.
        {isIOS() && !isStandalone() && <span className="mt-1 block text-xs text-muted">On iPhone: tap Share, then “Add to Home Screen”, open the app from there and turn alerts on.</span>}
        {err && <span className="block text-xs text-error">{err}</span>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => enable().catch((e) => setErr(String(e?.message ?? e)))}>Turn on</Button>
        <Button size="sm" variant="ghost" onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} setHidden(true); }}>Not now</Button>
      </div>
    </div>
  );
}

/** Settings card on the account page */
export function PhoneAlertsCard() {
  const { state, enable, disable } = usePush();
  const [msg, setMsg] = useState<{ tone: "green" | "rose" | "amber"; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ tone: "green", text: ok });
    } catch (e) {
      setMsg({ tone: "rose", text: (e as Error).message });
    }
  };
  return (
    <Card>
      <CardHeader title="Phone & desktop alerts" description="Alerts for immediate meetings, new bookings, approvals, cancellations and 15-minute reminders, even with the app closed." />
      <div className="space-y-3 p-5 text-sm">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {state === "loading" && <p className="text-muted">Checking…</p>}
        {state === "unsupported" && <Alert tone="amber">This browser can’t receive push alerts. Use Chrome, Edge or Firefox on Android or a computer{isIOS() ? ", or on iPhone add the app to the Home Screen first (Share, then Add to Home Screen)" : ""}. Alerts need HTTPS on a live server.</Alert>}
        {state === "blocked" && <Alert tone="rose">Alerts are blocked for this site. Open the browser’s site settings (the lock icon in the address bar), set Notifications to Allow, then reload.</Alert>}
        {state === "off" && (
          <>
            <p className="text-ink-2">Alerts are <b>off</b> on this device.</p>
            <Button onClick={() => run(enable, "Alerts turned on for this device.")}>Turn on alerts on this device</Button>
          </>
        )}
        {state === "on" && (
          <>
            <p className="text-accent-soft-ink">✓ Alerts are <b>on</b> for this device. Turn them on separately on each phone / computer you use.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => run(async () => { const r = await api<{ sent: number }>("/api/push/test", { method: "POST" }); if (!r.sent) throw new Error("No device received it. Turn alerts off and on again."); }, "Test alert sent. It should appear in a few seconds.")}>Send test alert</Button>
              <Button variant="ghost" onClick={() => run(disable, "Alerts turned off for this device.")}>Turn off</Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
