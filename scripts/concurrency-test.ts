/**
 * Double-booking stress test.
 *  1. 20 visitors try to book the SAME slot at the same instant (capacity 1) → exactly 1 must succeed.
 *  2. 10 visitors race for a capacity-2 slot → exactly 2 must succeed.
 *  3. A raw SQL insert that bypasses the app logic must be rejected by the Postgres exclusion constraint.
 * Test appointments are deleted afterwards.
 */
import "dotenv/config";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/db";
import { bookAppointment } from "../src/lib/booking";
import { getDaySlots } from "../src/lib/slots";

let TZ = "Asia/Kolkata";

async function firstFreeSlot(officerId: string) {
  for (let i = 1; i < 30; i++) {
    const date = DateTime.now().setZone(TZ).plus({ days: i }).toFormat("yyyy-MM-dd");
    const d = await getDaySlots(officerId, date);
    const s = d.slots.find((x) => x.available && x.booked === 0);
    if (s) return s;
  }
  throw new Error("no free slot found");
}

async function race(officerId: string, n: number) {
  const slot = await firstFreeSlot(officerId);
  const results = await Promise.allSettled(
    Array.from({ length: n }, (_, i) =>
      bookAppointment({ officerId, startAt: slot.start, name: `Race Visitor ${i}`, phone: `90000${String(i).padStart(5, "0")}`, purpose: "concurrency-test" }),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof bookAppointment>>>[];
  const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  const codes = [...new Set(rejected.map((r) => (r.reason as { code?: string }).code ?? String(r.reason)))];
  return { slot, ok, rejected, codes };
}

async function main() {
  const slug = process.env.CLIENT_ORG_SLUG || "abc-university";
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug } });
  TZ = org.timezone;
  console.log(`Organization: ${org.name}`);
  const officers = await prisma.officerProfile.findMany({ where: { organizationId: org.id, isBookable: true, allowSameDay: true }, include: { user: { select: { email: true } } } });
  const registrar = officers.find((o) => o.capacityPerSlot === 1)!;
  const exam = officers.find((o) => o.capacityPerSlot >= 2)!;
  let failed = false;

  const r1 = await race(registrar.id, 20);
  const pass1 = r1.ok.length === 1;
  console.log(`[${pass1 ? "PASS" : "FAIL"}] capacity 1: 20 concurrent requests for ${r1.slot.start} → ${r1.ok.length} booked, ${r1.rejected.length} rejected (${r1.codes.join(", ")})`);
  if (r1.ok[0]) console.log(`       token issued: ${r1.ok[0].value.token.tokenNumber}`);
  failed ||= !pass1;

  const cap = exam.capacityPerSlot;
  const r2 = await race(exam.id, 10);
  const seats = r2.ok.map((r) => r.value.appointment.seatNo).sort();
  const pass2 = r2.ok.length === cap && seats.join() === Array.from({ length: cap }, (_, i) => i + 1).join();
  console.log(`[${pass2 ? "PASS" : "FAIL"}] capacity ${cap}: 10 concurrent requests → ${r2.ok.length} booked (seats ${seats.join(", ")}), ${r2.rejected.length} rejected`);
  failed ||= !pass2;

  // 3. Bypass the app: insert an overlapping row directly
  const victim = r1.ok[0].value.appointment;
  let pass3 = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO appointments (id, organization_id, visitor_id, officer_id, start_at, end_at, seat_no, status, source, manage_code, updated_at)
      VALUES ('raw-test', ${victim.organizationId}, ${victim.visitorId}, ${victim.officerId}, ${victim.startAt}, ${victim.endAt}, 1, 'BOOKED', 'ONLINE', 'raw-test', now())`;
  } catch (e) {
    pass3 = String((e as Error).message).includes("appointments_no_overlap") || JSON.stringify(e).includes("23P01");
  }
  console.log(`[${pass3 ? "PASS" : "FAIL"}] raw SQL overlapping insert rejected by exclusion constraint`);
  failed ||= !pass3;

  // Cancelling releases the slot
  await prisma.appointment.update({ where: { id: victim.id }, data: { status: "CANCELLED" } });
  const again = await bookAppointment({ officerId: registrar.id, startAt: r1.slot.start, name: "After Cancel", phone: "9000099999" });
  console.log(`[PASS] cancelled slot re-booked → ${again.token.tokenNumber}`);

  // Cleanup
  const del = await prisma.appointment.deleteMany({ where: { OR: [{ purpose: "concurrency-test" }, { visitor: { name: "After Cancel" } }, { id: "raw-test" }] } });
  await prisma.visitor.deleteMany({ where: { OR: [{ name: { startsWith: "Race Visitor" } }, { name: "After Cancel" }] } });
  console.log(`cleaned up ${del.count} test appointments`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
