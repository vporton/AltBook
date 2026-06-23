import "dotenv/config";

import { defineConfig } from "prisma/config";

function migrationDatabaseUrl() {
  for (const name of ["DATABASE_DIRECT_URL", "DIRECT_URL", "DATABASE_URL"]) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

const databaseUrl = migrationDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
