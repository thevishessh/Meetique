/**
 * API tests over HTTP (run: npm test, with `npm run dev` running).
 * Sign-in, lockout, forced password change, password reset and role permissions.
 * Uses its own throw-away organization and users; skipped when the app is not running.
 */
import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

const BASE = (process.env.TEST_URL ?? process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
const PW = "Start@2026";
const tag = randomBytes(4).toString("hex");
const email = (k: string) => `${k}-${tag}@test.invalid`;
let orgId = "";
let up = false;

/** A tiny client that keeps the session cookie */
function client() {
  let cookie = "";
  const call = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const r = await fetch(BASE + path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      redirect: "manual",
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json: json as Record<string, any> };
  };
  return { call, login: (who: string, pw = PW) => call("/api/auth/login", { body: { email: email(who), password: pw } }) };
}

before(async () => {
  up = await fetch(BASE + "/login").then((r) => r.ok).catch(() => false);
  if (!up) return;
  const hash = await bcrypt.hash(PW, 10);
  const org = await prisma.organization.create({ data: { name: `API test ${tag}`, slug: `test-api-${tag}`, shortCode: "TAP", timezone: "Asia/Kolkata" } });
  orgId = org.id;
  const mk = (k: string, role: "STAFF" | "RECEPTIONIST" | "OFFICER", mustChange = false) =>
    prisma.user.create({ data: { organizationId: org.id, name: k, email: email(k), passwordHash: hash, role, employeeId: `A${k}${tag}`.slice(0, 20), mustChangePassword: mustChange } });
  await mk("staff", "STAFF");
  await mk("locked", "STAFF");
  await mk("fresh", "STAFF", true);
  await mk("reset", "STAFF");
  await mk("desk", "RECEPTIONIST");
});

after(async () => {
  if (orgId) await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("API over HTTP", () => {
  test("signed out: booking needs a login", async (t) => {
    if (!up) return t.skip("app not running");
    const r = await client().call("/api/appointments", { body: { officerId: "x", startAt: new Date().toISOString() } });
    assert.equal(r.status, 401);
  });

  test("five wrong passwords lock the account, and the answer never reveals it", async (t) => {
    if (!up) return t.skip("app not running");
    const c = client();
    for (let i = 0; i < 5; i++) assert.equal((await c.login("locked", "wrong")).status, 401);
    const locked = await c.login("locked");
    assert.equal(locked.status, 401, "the right password is refused while locked");
    const unknown = await c.login("nobody");
    assert.equal(locked.json.error.message, unknown.json.error.message, "locked and unknown look the same");
  });

  test("changing the password signs out other sessions", async (t) => {
    if (!up) return t.skip("app not running");
    const a = client(), b = client();
    await a.login("staff");
    await b.login("staff");
    assert.equal((await a.call("/api/notifications")).status, 200);
    assert.equal((await b.call("/api/auth/password", { body: { currentPassword: PW, newPassword: "Moved@2026" } })).status, 200);
    assert.equal((await a.call("/api/notifications")).status, 401, "old session ends");
    assert.equal((await b.call("/api/notifications")).status, 200, "the browser that changed it stays in");
    await b.call("/api/auth/password", { body: { currentPassword: "Moved@2026", newPassword: PW } });
  });

  test("push alerts accept only real push services", async (t) => {
    if (!up) return t.skip("app not running");
    const c = client();
    await c.login("desk");
    const keys = { p256dh: "BOr7test_p256dh_key_000000000000000000000000000000000000", auth: "testAuthKey00000" };
    assert.equal((await c.call("/api/push/subscribe", { body: { endpoint: "http://169.254.169.254/latest", keys } })).status, 422);
    assert.equal((await c.call("/api/push/subscribe", { body: { endpoint: "https://internal.example.com/x", keys } })).status, 422);
    const ok = await c.call("/api/push/subscribe", { body: { endpoint: `https://fcm.googleapis.com/fcm/send/test-${tag}`, keys } });
    assert.equal(ok.status, 200);
  });

  test("internal mode: booking lists need a sign-in; pages send security headers", async (t) => {
    if (!up) return t.skip("app not running");
    if (process.env.PUBLIC_BOOKING !== "false") return t.skip("public booking mode");
    const anon = client();
    assert.equal((await anon.call(`/api/officers?org=test-api-${tag}`)).status, 401);
    assert.equal((await anon.call(`/api/departments?org=test-api-${tag}`)).status, 401);
    const r = await fetch(BASE + "/login");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  test("a temporary password must be replaced before anything else works", async (t) => {
    if (!up) return t.skip("app not running");
    const c = client();
    assert.equal((await c.login("fresh")).json.redirect, "/change-password");
    assert.equal((await c.call("/api/notifications")).status, 403);
    assert.equal((await c.call("/api/auth/password", { body: { currentPassword: PW, newPassword: "abcdefgh" } })).status, 422, "weak password");
    assert.equal((await c.call("/api/auth/password", { body: { currentPassword: PW, newPassword: "Better@2026" } })).status, 200);
    assert.equal((await c.call("/api/notifications")).status, 200);
  });

  test("forgot password: one-time link, same answer for unknown emails", async (t) => {
    if (!up) return t.skip("app not running");
    const c = client();
    const known = await c.call("/api/auth/forgot", { body: { email: email("reset") } });
    const unknown = await c.call("/api/auth/forgot", { body: { email: email("nobody") } });
    assert.equal(known.json.message, unknown.json.message);
    if (!known.json.devLink) return t.skip("email is configured, so the link is not returned");
    const token = String(known.json.devLink).split("/reset-password/")[1];
    assert.equal((await c.call("/api/auth/reset", { body: { token, password: "Reset@2026" } })).status, 200);
    assert.equal((await c.call("/api/auth/reset", { body: { token, password: "Again@2026" } })).status, 400);
    assert.equal((await c.login("reset", "Reset@2026")).status, 200);
  });

  test("roles: staff and reception stay out of what is not theirs", async (t) => {
    if (!up) return t.skip("app not running");
    const staff = client();
    await staff.login("staff");
    assert.equal((await staff.call("/api/reports")).status, 403);
    assert.equal((await staff.call("/api/summons", { body: { targetUserIds: ["x"], when: "now", durationMin: 15, purpose: "xx" } })).status, 403);
    assert.equal((await staff.call("/api/check-in", { body: { scan: "TAP-2026-000001" } })).status, 403);
    const desk = client();
    await desk.login("desk");
    assert.equal((await desk.call("/api/holidays", { body: { date: "2030-01-01", name: "No" } })).status, 403);
    assert.equal((await desk.call("/api/staff", { body: {} })).status, 403);
  });
});
