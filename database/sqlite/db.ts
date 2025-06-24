import sqlite, { type Database } from "better-sqlite3";
import fs from "fs";
import path from "path";

let singleton: Database | undefined = undefined;
let backupDone = false;

function backupDatabase(dbPath: string) {
  if (backupDone || !fs.existsSync(dbPath)) {
    return;
  }

  try {
    const dir = path.dirname(dbPath);
    const ext = path.extname(dbPath);
    const base = path.basename(dbPath, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(dir, `${base}-${timestamp}${ext}`);

    fs.copyFileSync(dbPath, backupPath);
    backupDone = true;
  } catch (err) {
    console.error("Failed to backup database", err);
  }
}

export function db(): Database {
  if (!singleton) {
    if (!process.env.DATABASE_URL) {
      throw new Error("Missing DATABASE_URL in .env file");
    }

    backupDatabase(process.env.DATABASE_URL);
    singleton = sqlite(process.env.DATABASE_URL);
  }
  return singleton;
}
