import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 recommends using process.env directly when generate may run
    // without a live database URL, for example in CI or first install flows.
    url: process.env.DATABASE_URL ?? "",
  },
});
