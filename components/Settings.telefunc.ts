import { savePhases, readPhases } from '../database/sqlite/queries/library-settings';

export async function onGetPhases(): Promise<string[]> {
  return readPhases();
}

export async function onSetPhases(phases: string[]): Promise<void> {
  savePhases(phases);
}
