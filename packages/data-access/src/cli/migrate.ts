import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

const main = async () => {
  const envFile = process.env.WEVLO_ENV_FILE ?? ".env.local";
  const envPath = resolve(process.env.INIT_CWD ?? process.cwd(), envFile);
  loadDotenv({ path: envPath });
  const { createDatabase, destroyDatabase } = await import("../database");
  const { runMigrations } = await import("../migrations");

  const database = createDatabase();

  try {
    await runMigrations(database);
    console.log("[data-access] migrations applied");
  } finally {
    await destroyDatabase(database);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
