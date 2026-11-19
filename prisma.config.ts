import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations and seeding use the direct (unpooled) connection when one is given, e.g. Neon's DIRECT_URL;
  // the running app always uses DATABASE_URL (the pooled one on Neon).
  datasource: { url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL") },
});
