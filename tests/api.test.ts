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

  test("five wrong passwords lock the account, even for the right one", async (t) => {
    if (!up) return t.skip("app not running");
    const c = client();
    for (let i = 0; i < 4; i++) assert.equal((await c.login("locked", "wrong")).status, 401);
    assert.equal((await c.login("locked", "wrong")).status, 423);
    assert.equal((await c.login("locked")).status, 423);
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
