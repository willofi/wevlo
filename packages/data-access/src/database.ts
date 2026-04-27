import pg from "pg";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";

import { getDatabaseUrl } from "./config";
import type { DatabaseSchema } from "./schema";

const { Pool } = pg;

export type Database = Kysely<DatabaseSchema>;
export type DatabaseTransaction = Transaction<DatabaseSchema>;
export type DatabaseExecutor = Database | DatabaseTransaction;

export const createDatabase = (connectionString = getDatabaseUrl()): Database => {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString
      }) as never
    })
  });
};

export const destroyDatabase = async (database: Database): Promise<void> => {
  await database.destroy();
};

export const healthcheckDatabase = async (database: Database): Promise<void> => {
  await sql`select 1`.execute(database);
};

export const runInTransaction = async <T>(
  database: Database,
  callback: (transaction: DatabaseTransaction) => Promise<T>
): Promise<T> => {
  return database.transaction().execute(callback);
};

export { sql };
