import { createDatabase, destroyDatabase, runMigrations, validateApiRuntimeEnv } from "@wevlo/data-access";

import { buildApi } from "./app";

const start = async () => {
  validateApiRuntimeEnv();
  const database = createDatabase();
  await runMigrations(database);
  const app = buildApi({
    database
  });
  await app.listen({
    host: "0.0.0.0",
    port: 4000
  });

  const shutdown = async () => {
    await app.close();
    await destroyDatabase(database);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
