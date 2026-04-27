import { createDatabase, destroyDatabase, validateApiRuntimeEnv } from "@wevlo/data-access";

import { buildApi } from "./app.js";

const start = async () => {
  validateApiRuntimeEnv();
  const database = createDatabase();
  const app = buildApi({
    database
  });
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);
  await app.listen({
    host: "0.0.0.0",
    port: Number.isFinite(port) ? port : 4000
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
