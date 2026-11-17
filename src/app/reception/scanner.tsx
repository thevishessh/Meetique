"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { api } from "@/components/client-api";
import { Button, Card, CardHeader, Input, cx } from "@/components/ui";

type Result = { ok: boolean; title: string; lines: string[] };

export function Scanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number>(0);
  const lastScan = useRef<{ v: string; t: number }>({ v: "", t: 0 });
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [camErr, setCamErr] = useState<string | null>(null);

  const submit = useCallback(
    async (scan: string) => {
      setBusy(true);
      try {
        const r = await api<{ tokenNumber: string; visitor: string; officer: string; time: string; message: string; status: string }>("/api/check-in", { body: { scan } });
        setResult({ ok: r.message === "Checked in", title: `${r.message} · ${r.tokenNumber}`, lines: [r.visitor, `${r.officer} · ${r.time}`] });
        router.refresh();
      } catch (e) {
        setResult({ ok: false, title: (e as Error).message, lines: [] });
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOn(false);
  }, []);

  const tick = useCallback(() => {
    const v = video.current, c = canvas.current;
    if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      const now = Date.now();
      if (code?.data && (code.data !== lastScan.current.v || now - lastScan.current.t > 4000)) {
        lastScan.current = { v: code.data, t: now };
        navigator.vibrate?.(80);
        void submit(code.data);
      }
    }
    raf.current = requestAnimationFrame(tick);
  }, [submit]);

  const start = async () => {
    setCamErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setOn(true);
      raf.current = requestAnimationFrame(tick);
    } catch {
      setCamErr("Camera not available. Allow camera access, or type the token number below.");
    }
  };

  useEffect(() => stop, [stop]);

  return (
    <Card>
      <CardHeader title="Scan QR token" description="Point the camera at the visitor's QR, or enter the token number." action={on ? <Button size="sm" variant="secondary" onClick={stop}>Stop camera</Button> : <Button size="sm" onClick={start}>Start camera</Button>} />
      <div className="space-y-4 p-5">
        <div className={cx("relative overflow-hidden rounded-xl bg-slate-900", on ? "aspect-video" : "hidden")}>
          <video ref={video} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <canvas ref={canvas} className="hidden" />
        {camErr && <p className="text-sm text-amber-700">{camErr}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void submit(manual.trim());
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Token number, e.g. ABC-2026-000124" className="font-mono uppercase" />
          <Button className="shrink-0 whitespace-nowrap" disabled={busy || !manual.trim()}>{busy ? "…" : "Check in"}</Button>
        </form>
        {result && (
          <div className={cx("rounded-xl px-4 py-3 ring-1 ring-inset", result.ok ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-rose-50 text-rose-900 ring-rose-200")}>
            <div className="font-semibold">{result.ok ? "✓ " : "✕ "}{result.title}</div>
            {result.lines.map((l) => <div key={l} className="text-sm">{l}</div>)}
          </div>
        )}
      </div>
    </Card>
  );
}
