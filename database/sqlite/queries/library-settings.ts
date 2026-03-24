import { db } from '../db.js';
import {
  setBaseFolder,
  getBaseFolder,
  setPhases,
  getPhases,
  setKeepPlayHead,
  getKeepPlayHead
} from '../schema/library-settings.js';
import { type SetPhase, migratePhases, stringToSetPhase } from '../../../lib/set-phase.js';

const DEFAULT_PHASES: SetPhase[] = ['starter', 'buildup', 'peak', 'release', 'feature'].map(stringToSetPhase);

export function saveBaseFolder(folder: string): void {
  const stmt = db().prepare(setBaseFolder);
  stmt.run(folder);
}

export function readBaseFolder(): string | null {
  const stmt = db().prepare(getBaseFolder);
  const row = stmt.get() as any;
  return row ? (row.base_folder as string | null) : null;
}

export function savePhases(phases: SetPhase[]): void {
  const stmt = db().prepare(setPhases);
  stmt.run(JSON.stringify(phases));
}

export function readPhases(): SetPhase[] {
  const stmt = db().prepare(getPhases);
  const row = stmt.get() as any;
  if (!row || row.phases == null) {
    return DEFAULT_PHASES;
  }
  try {
    const parsed = JSON.parse(row.phases);
    const result = migratePhases(parsed);
    return result.length > 0 ? result : DEFAULT_PHASES;
  } catch {
    return DEFAULT_PHASES;
  }
}

/** Helper: read phases as plain name strings (for callers that only need names) */
export function readPhaseNames(): string[] {
  return readPhases().map(p => p.name);
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
