import { AsyncLocalStorage } from "node:async_hooks";

export type DbQueryMetrics = {
  queryCount: number;
  slowQueryCount: number;
  totalDurationMs: number;
};

const storage = new AsyncLocalStorage<DbQueryMetrics>();

export const runWithDbQueryMetrics = <T>(metrics: DbQueryMetrics, callback: () => T): T => {
  return storage.run(metrics, callback);
};

export const getDbQueryMetrics = (): DbQueryMetrics | undefined => {
  return storage.getStore();
};
