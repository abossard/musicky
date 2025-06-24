import { db } from '../db.js';
import { setBaseFolder, getBaseFolder } from '../schema/library-settings.js';

export function saveBaseFolder(folder: string): void {
  const stmt = db().prepare(setBaseFolder);
  stmt.run(folder);
}

export function readBaseFolder(): string | null {
  const stmt = db().prepare(getBaseFolder);
  const row = stmt.get() as any;
  return row ? (row.base_folder as string | null) : null;
}
