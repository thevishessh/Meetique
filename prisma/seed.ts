/**
 * Seed dispatcher. Choose the profile with SEED_PROFILE in .env:
 *   SEED_PROFILE=cu-unnao   → Chandigarh University, Unnao Campus (client setup, no sample bookings)
 *   SEED_PROFILE=demo       → "ABC University" demo with sample bookings
 * Run:  npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const profiles: Record<string, () => Promise<{ default: (p: PrismaClient) => Promise<void> }>> = {
  "cu-unnao": () => import("./seeds/cu-unnao"),
  demo: () => import("./seeds/demo"),
};

async function run() {
  const name = process.env.SEED_PROFILE || "demo";
  const load = profiles[name];
  if (!load) throw new Error(`Unknown SEED_PROFILE "${name}". Use one of: ${Object.keys(profiles).join(", ")}`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    console.log(`Seeding profile: ${name}`);
    await (await load()).default(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
