import { db as sqliteDb } from "./database/sqlite/db";

declare module "telefunc" {
  namespace Telefunc {
    interface Context {
      db: ReturnType<typeof sqliteDb>;
    }
  }
}

declare global {
  namespace Vike {
    interface PageContext {
      db: ReturnType<typeof sqliteDb>;
    }
  }
}

export {};
