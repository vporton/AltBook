import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

function createPrismaClient() {
  if (!connectionString) {
    return createUnavailablePrismaClient(
      new Error("DATABASE_URL is not configured."),
    );
  }

  try {
    return new PrismaClient({
      adapter: new PrismaPg({
        connectionString,
      }) as Prisma.PrismaClientOptions["adapter"],
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  } catch (error) {
    return createUnavailablePrismaClient(
      error instanceof Error ? error : new Error("Failed to initialize Prisma."),
    );
  }
}

function createUnavailablePrismaClient(error: Error) {
  console.error(error);

  const reject = async () => {
    throw error;
  };

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "$disconnect" || property === "$connect") {
          return async () => undefined;
        }

        if (property === "$transaction") {
          return reject;
        }

        if (typeof property === "symbol") {
          return undefined;
        }

        return new Proxy(
          {},
          {
            get() {
              return reject;
            },
          },
        );
      },
    },
  ) as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
