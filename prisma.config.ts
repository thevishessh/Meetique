import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations and seeding use the direct (unpooled) connection when one is given, e.g. Neon's DIRECT_URL;
// the running app always uses DATABASE_URL (the pooled one on Neon).
// `prisma generate` needs no database, so a missing URL must not fail installs (e.g. on Vercel).
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});
