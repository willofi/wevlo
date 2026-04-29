import pg from "pg";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";

import { getDatabaseUrl } from "./config";
import type { DatabaseSchema } from "./schema";

const { Pool } = pg;
const DEFAULT_DB_QUERY_LOG_MIN_MS = 200;

export type Database = Kysely<DatabaseSchema>;
export type DatabaseTransaction = Transaction<DatabaseSchema>;
export type DatabaseExecutor = Database | DatabaseTransaction;

const resolveDbQueryLogMinMs = (): number => {
  const raw = process.env.WEVLO_DB_QUERY_LOG_MIN_MS;
  if (!raw) {
    return DEFAULT_DB_QUERY_LOG_MIN_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_DB_QUERY_LOG_MIN_MS;
  }

  return parsed;
};

const truncateSql = (sqlText: string, maxLength = 300): string => {
  if (sqlText.length <= maxLength) {
    return sqlText;
  }

  return `${sqlText.slice(0, maxLength)}...`;
};

const normalizeConnectionString = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");

    // pg-connection-string v2 currently treats sslmode=require as verify-full.
    // Preserve libpq-compatible require behavior until v3/v9 migration is complete.
    if (sslmode === "require" && !url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
};

const resolveSslConfig = (connectionString: string): pg.PoolConfig["ssl"] | undefined => {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");

    if (sslmode === "require" || sslmode === "no-verify") {
      return { rejectUnauthorized: false };
    }

    return undefined;
  } catch {
    return undefined;
  }
};

export const createDatabase = (connectionString = getDatabaseUrl()): Database => {
  const normalizedConnectionString = normalizeConnectionString(connectionString);
  const dbQueryLogMinMs = resolveDbQueryLogMinMs();

  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: normalizedConnectionString,
        ssl: resolveSslConfig(normalizedConnectionString)
      }) as never
    }),
    log: (event) => {
      if (event.level === "query" && event.queryDurationMillis >= dbQueryLogMinMs) {
        console.info("[perf][db.query]", JSON.stringify({
          durationMs: Number(event.queryDurationMillis.toFixed(1)),
          thresholdMs: dbQueryLogMinMs,
          sql: truncateSql(event.query.sql),
          paramsCount: event.query.parameters.length
        }));
      }

      if (event.level === "error") {
        console.error("[perf][db.error]", JSON.stringify({
          error: event.error instanceof Error ? event.error.message : String(event.error),
          sql: truncateSql(event.query.sql),
          paramsCount: event.query.parameters.length
        }));
      }
    }
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
