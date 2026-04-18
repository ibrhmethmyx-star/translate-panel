import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __dstPrisma__: PrismaClient | undefined;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPrismaClient(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    return null;
  }

  if (
    connectionString.startsWith("prisma://") ||
    connectionString.startsWith("prisma+postgres://")
  ) {
    throw new Error(
      "DATABASE_URL must be a direct Postgres connection string when using PrismaPg.",
    );
  }

  if (!globalThis.__dstPrisma__) {
    const adapter = new PrismaPg({
      connectionString,
    });

    globalThis.__dstPrisma__ = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalThis.__dstPrisma__;
}
