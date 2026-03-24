import { savePhases, readPhases, saveKeepPlayHead, readKeepPlayHead } from '../database/sqlite/queries/library-settings';
import type { SetPhase } from '../lib/set-phase';

export async function onGetPhases(): Promise<SetPhase[]> {
  return readPhases();
}

export async function onSetPhases(phases: SetPhase[]): Promise<void> {
  savePhases(phases);
}

export async function onGetKeepPlayHead(): Promise<boolean> {
  return readKeepPlayHead();
}

export async function onSetKeepPlayHead(enabled: boolean): Promise<void> {
  saveKeepPlayHead(enabled);
}
