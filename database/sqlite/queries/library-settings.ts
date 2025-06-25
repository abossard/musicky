import { db } from '../db.js';
import {
  setBaseFolder,
  getBaseFolder,
  setPhases,
  getPhases,
  setKeepPlayHead,
  getKeepPlayHead
} from '../schema/library-settings.js';

export function saveBaseFolder(folder: string): void {
  const stmt = db().prepare(setBaseFolder);
  stmt.run(folder);
}

export function readBaseFolder(): string | null {
  const stmt = db().prepare(getBaseFolder);
  const row = stmt.get() as any;
  return row ? (row.base_folder as string | null) : null;
}

export function savePhases(phases: string[]): void {
  const stmt = db().prepare(setPhases);
  stmt.run(JSON.stringify(phases));
}

export function readPhases(): string[] {
  const stmt = db().prepare(getPhases);
  const row = stmt.get() as any;
  if (!row || row.phases == null) {
    return ['starter', 'buildup', 'peak', 'release', 'feature'];
  }
  try {
    return JSON.parse(row.phases) as string[];
  } catch {
    return ['starter', 'buildup', 'peak', 'release', 'feature'];
  }
}

export function saveKeepPlayHead(enabled: boolean): void {
  const stmt = db().prepare(setKeepPlayHead);
  stmt.run(enabled ? 1 : 0);
}

export function readKeepPlayHead(): boolean {
  const stmt = db().prepare(getKeepPlayHead);
  const row = stmt.get() as any;
  return row ? Boolean(row.keep_play_head) : false;
}
