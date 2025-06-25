import { savePhases, readPhases, saveKeepPlayHead, readKeepPlayHead } from '../database/sqlite/queries/library-settings';

export async function onGetPhases(): Promise<string[]> {
  return readPhases();
}

export async function onSetPhases(phases: string[]): Promise<void> {
  savePhases(phases);
}

export async function onGetKeepPlayHead(): Promise<boolean> {
  return readKeepPlayHead();
}

export async function onSetKeepPlayHead(enabled: boolean): Promise<void> {
  saveKeepPlayHead(enabled);
}
