import { db } from '../db';
import * as queries from '../schema/phase-versions';

const client = db();

export interface PhaseVersion {
  id: number;
  phaseName: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

interface PhaseVersionRow {
  id: number;
  phase_name: string;
  version: number;
  is_active: number;
  created_at: string;
}

function rowToPhaseVersion(row: PhaseVersionRow): PhaseVersion {
  return {
    id: row.id,
    phaseName: row.phase_name,
    version: row.version,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

/** Get all versions for a phase, ordered by version desc */
export function getPhaseVersions(phaseName: string): PhaseVersion[] {
  const rows = client.prepare(queries.getPhaseVersions).all(phaseName) as PhaseVersionRow[];
  return rows.map(rowToPhaseVersion);
}

/** Get the active (latest) version for a phase */
export function getActiveVersion(phaseName: string): PhaseVersion | null {
  const row = client.prepare(queries.getActiveVersion).get(phaseName) as PhaseVersionRow | undefined;
  return row ? rowToPhaseVersion(row) : null;
}

/** Create a new version of a phase (atomic transaction):
 *  1. Set current active version's is_active = 0
 *  2. Rename all song_tags with tag_label = phaseName to "phaseName__v{oldVersion}"
 *  3. Copy: for each song tagged "phaseName__v{oldVersion}", add tag "phaseName"
 *  4. Insert new phase_versions row (version = old + 1, is_active = 1)
 *  Returns the new version number.
 */
export function createNewVersion(phaseName: string): number {
  const createVersionTx = client.transaction(() => {
    // Get current active version
    const current = client.prepare(queries.getActiveVersion).get(phaseName) as PhaseVersionRow | undefined;
    const oldVersion = current ? current.version : 1;
    const newVersion = oldVersion + 1;

    // Ensure v1 exists if no current version
    if (!current) {
      client.prepare(queries.insertVersion).run(phaseName, 1);
    }

    // 1. Deactivate current active version
    client.prepare(queries.deactivateVersion).run(phaseName);

    // 2. Rename current song_tags from "phaseName" to "phaseName__v{oldVersion}"
    const archivedLabel = `${phaseName}__v${oldVersion}`;
    client.prepare(queries.renameSongTags).run(archivedLabel, phaseName);

    // 3. Copy: for each song tagged with archived label, add the clean tag back
    const songs = client.prepare(queries.getSongsWithTag).all(archivedLabel) as { file_path: string }[];
    const insertStmt = client.prepare(queries.insertSongTag);
    for (const song of songs) {
      insertStmt.run(song.file_path, phaseName);
    }

    // 4. Insert new version row
    client.prepare(queries.insertVersion).run(phaseName, newVersion);

    return newVersion;
  });

  return createVersionTx();
}

/** Get songs for a specific version of a phase
 *  - Active version: songs with tag_label = phaseName
 *  - Old version: songs with tag_label = "phaseName__v{version}"
 */
export function getSongsForVersion(phaseName: string, version: number): string[] {
  const active = client.prepare(queries.getActiveVersion).get(phaseName) as PhaseVersionRow | undefined;
  const tagLabel = (active && active.version === version) ? phaseName : `${phaseName}__v${version}`;
  const rows = client.prepare(queries.getSongsWithTag).all(tagLabel) as { file_path: string }[];
  return rows.map(r => r.file_path);
}

/** Ensure a phase has at least a v1 entry (for new phases) */
export function ensurePhaseVersion(phaseName: string): void {
  const existing = client.prepare(queries.getActiveVersion).get(phaseName) as PhaseVersionRow | undefined;
  if (!existing) {
    client.prepare(queries.insertVersion).run(phaseName, 1);
  }
}

/** Get all phases with their active version number */
export function getAllPhaseVersions(): { phaseName: string; activeVersion: number }[] {
  const rows = client.prepare(queries.getAllActiveVersions).all() as { phase_name: string; version: number }[];
  return rows.map(r => ({ phaseName: r.phase_name, activeVersion: r.version }));
}
