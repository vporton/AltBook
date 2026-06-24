import { spawn } from "node:child_process";

const MIGRATION_TIMEOUT_MS = 55_000;
const PRISMA_BIN = "node_modules/.bin/prisma";

function migrationDatabaseUrl() {
  for (const name of ["DATABASE_DIRECT_URL", "DIRECT_URL", "DATABASE_URL"]) {
    const value = process.env[name]?.trim();

    if (value) {
      return { name, value };
    }
  }

  return undefined;
}

const migrationUrl = migrationDatabaseUrl();

if (!migrationUrl) {
  console.error(
    "No migration database URL found. Set DATABASE_DIRECT_URL, DIRECT_URL, or DATABASE_URL before deploying.",
  );
  process.exit(1);
}

console.log(`Using ${migrationUrl.name} for Prisma migrations.`);

const child = spawn(PRISMA_BIN, ["migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

const timeout = setTimeout(() => {
  console.error(
    `Prisma migrate deploy timed out after ${MIGRATION_TIMEOUT_MS}ms.`,
  );
  child.kill("SIGTERM");

  setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }, 5_000).unref();
}, MIGRATION_TIMEOUT_MS);

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on("close", (code, signal) => {
  clearTimeout(timeout);

  if (signal) {
    console.error(`Prisma migrate deploy exited from signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
