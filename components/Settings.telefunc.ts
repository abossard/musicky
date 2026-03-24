import { saveKeepPlayHead, readKeepPlayHead } from '../database/sqlite/queries/library-settings';

export async function onGetKeepPlayHead(): Promise<boolean> {
  return readKeepPlayHead();
}

export async function onSetKeepPlayHead(enabled: boolean): Promise<void> {
  saveKeepPlayHead(enabled);
}
