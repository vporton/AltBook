export function runtimeDatabaseUrl() {
  return firstEnvValue("DATABASE_POOL_URL", "DATABASE_URL");
}

export function migrationDatabaseUrl() {
  return firstEnvValue("DATABASE_DIRECT_URL", "DIRECT_URL", "DATABASE_URL");
}

function firstEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}
