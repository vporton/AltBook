import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function tuneDatabaseUrl(url: string) {
  const parsed = new URL(url);

  // Fly's default Prisma pool is too small for concurrent page renders.
  parsed.searchParams.set("connection_limit", "5");
  parsed.searchParams.set("pool_timeout", "20");

  return parsed.toString();
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = tuneDatabaseUrl(process.env.DATABASE_URL);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

globalForPrisma.prisma = prisma;
