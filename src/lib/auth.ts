import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { AppError } from "./errors";
import type { Role } from "@/generated/prisma/enums";

const COOKIE = "mq_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  officerId: string | null;
  /** Designated officer who may call immediate meetings */
  canSummon: boolean;
  /** L Code (employee code) */
  employeeId: string | null;
  /** Must set a new password before using the app */
  mustChangePassword: boolean;
  /** Set when this staff member is the personal assistant (PA) of an officer */
  pa: { officerId: string; officerName: string } | null;
  org: { id: string; name: string; slug: string; timezone: string; shortCode: string };
};

/** Current user (re-validated against the DB on each call), or null */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const u = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        organization: { select: { id: true, name: true, slug: true, timezone: true, shortCode: true } },
        officerProfile: { select: { id: true, canSummon: true } },
        paFor: { select: { id: true, user: { select: { name: true } } } },
      },
    });
    if (!u || !u.isActive) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organizationId,
      officerId: u.officerProfile?.id ?? null,
      canSummon: !!u.officerProfile?.canSummon,
      employeeId: u.employeeId,
      mustChangePassword: u.mustChangePassword,
      pa: u.role === "STAFF" && u.paFor ? { officerId: u.paFor.id, officerName: u.paFor.user.name } : null,
      org: u.organization,
    };
  } catch {
    return null;
  }
}

/** For API routes: throws 401/403. Blocks everything until a required password change is done. */
export async function requireApiUser(...roles: Role[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new AppError("UNAUTHORIZED", "Please sign in", 401);
  if (u.mustChangePassword) throw new AppError("PASSWORD_CHANGE_REQUIRED", "Please set a new password first", 403);
  if (roles.length && !roles.includes(u.role)) throw new AppError("FORBIDDEN", "You do not have access to this action", 403);
  return u;
}

/** For pages: redirects */
export async function requirePageUser(...roles: Role[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/change-password");
  if (roles.length && !roles.includes(u.role)) redirect(homeFor(u.role));
  return u;
}

/** Reception desk access: admins and receptionists (all officers), or an officer's PA (that officer only) */
export function canUseReception(u: SessionUser): boolean {
  return u.role === "ADMIN" || u.role === "RECEPTIONIST" || !!u.pa;
}

/** Which officer's visitors this user may handle at reception; null = all officers */
export function receptionScope(u: SessionUser): string | null {
  return u.role === "ADMIN" || u.role === "RECEPTIONIST" ? null : u.pa?.officerId ?? null;
}

export function homeFor(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "OFFICER" ? "/officer" : role === "STAFF" ? "/me" : "/reception";
}
