import {
  getPhaseVersions as dbGetPhaseVersions,
  getActiveVersion,
  createNewVersion as dbCreateNewVersion,
  getSongsForVersion as dbGetSongsForVersion,
  getAllPhaseVersions as dbGetAllPhaseVersions,
  type PhaseVersion,
} from '../../database/sqlite/queries/phase-versions';

export async function onGetPhaseVersions(phaseName: string): Promise<PhaseVersion[]> {
  return dbGetPhaseVersions(phaseName);
}

export async function onCreatePhaseVersion(phaseName: string): Promise<number> {
  return dbCreateNewVersion(phaseName);
}

export async function onGetSongsForVersion(phaseName: string, version: number): Promise<string[]> {
  return dbGetSongsForVersion(phaseName, version);
}

export async function onGetAllPhaseVersions(): Promise<{ phaseName: string; activeVersion: number }[]> {
  return dbGetAllPhaseVersions();
}

export async function onGetActivePhaseVersion(phaseName: string): Promise<PhaseVersion | null> {
  return getActiveVersion(phaseName);
}
