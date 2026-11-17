import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { staffImportSchema } from "@/lib/validation";

/** Minimal CSV line parser (handles quoted values with commas) */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * POST /api/staff/import { csv, password }
 * Each line: name,email,employeeId,department,jobTitle,phone  (header line optional)
 * Unknown departments are created. Existing emails are skipped. All get role STAFF + the given initial password.
 */
export const POST = handle(async (req: Request) => {
  const admin = await requireApiUser("ADMIN");
  const { csv, password } = staffImportSchema.parse(await readJson(req));
  const hash = await hashPassword(password);
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] && /^name\s*,\s*email/i.test(lines[0])) lines.shift();

  const deps = new Map((await prisma.department.findMany({ where: { organizationId: admin.organizationId } })).map((d) => [d.name.toLowerCase(), d.id]));
  const created: string[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (const [i, line] of lines.entries()) {
    const [name, emailRaw, employeeId, dept, jobTitle, phone] = parseLine(line);
    const email = (emailRaw ?? "").toLowerCase();
    if (!name || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) { skipped.push({ line: i + 1, reason: "name and a valid email are required" }); continue; }
    if (await prisma.user.findUnique({ where: { email } })) { skipped.push({ line: i + 1, reason: `${email} already exists` }); continue; }
    if (employeeId && (await prisma.user.findFirst({ where: { organizationId: admin.organizationId, employeeId } }))) {
      skipped.push({ line: i + 1, reason: `employee ID ${employeeId} already used` });
      continue;
    }
    let departmentId: string | null = null;
    if (dept) {
      departmentId = deps.get(dept.toLowerCase()) ?? null;
      if (!departmentId) {
        const d = await prisma.department.create({ data: { organizationId: admin.organizationId, name: dept } });
        deps.set(dept.toLowerCase(), d.id);
        departmentId = d.id;
      }
    }
    await prisma.user.create({
      data: { organizationId: admin.organizationId, name, email, role: "STAFF", passwordHash: hash, employeeId: employeeId || null, jobTitle: jobTitle || null, phone: phone || null, departmentId },
    });
    created.push(email);
  }
  return ok({ created: created.length, skipped });
});
