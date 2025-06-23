import type { Get, UniversalMiddleware } from "@universal-middleware/core";
import { db as sqliteDb } from "../database/sqlite/db";

declare global {
  namespace Universal {
    interface Context {
      db: ReturnType<typeof sqliteDb>;
    }
  }
}

// Add `db` to the Context
export const dbMiddleware: Get<[], UniversalMiddleware> = () => async (_request, context, _runtime) => {
  const db = sqliteDb();

  return {
    ...context,
    db: db,
  };
};
