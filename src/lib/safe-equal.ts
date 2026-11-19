import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison for secrets (hashing first makes the lengths equal) */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
