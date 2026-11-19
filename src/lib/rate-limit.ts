/**
 * Tiny in-memory rate limiter (per server process). Good enough for a single campus server;
 * use Redis or similar if you run several instances behind a load balancer.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

/** Look at a bucket without counting this request */
export function peek(key: string): number {
  const b = buckets.get(key);
  return b && b.resetAt > Date.now() ? b.count : 0;
}

/**
 * The caller's IP. Forwarded headers can be forged by anyone, so they are used only when
 * TRUST_PROXY=true (a reverse proxy such as nginx that overwrites X-Real-IP / X-Forwarded-For).
 * Returns null when the IP is unknown; callers then skip the per-IP limit.
 */
export function clientIp(req: Request): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
}
