import "dotenv/config";

import { defineConfig } from "prisma/config";
import { migrationDatabaseUrl } from "./lib/database-url";

const databaseUrl = migrationDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
