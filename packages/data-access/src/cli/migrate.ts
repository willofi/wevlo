import { createDatabase, destroyDatabase } from "../database";
import { runMigrations } from "../migrations";

const main = async () => {
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
