import { MP3Library, type MP3LibraryScan, type MP3EditHistory } from '../lib/mp3-library';
import { saveBaseFolder, readBaseFolder } from '../database/sqlite/queries/library-settings';
import { fetchHistory, markHistoryReverted } from '../database/sqlite/queries/mp3-history';
import { MP3MetadataManager } from '../lib/mp3-metadata';

const library = new MP3Library();
const mp3Manager = new MP3MetadataManager();

export async function onSetBaseFolder(path: string): Promise<void> {
  saveBaseFolder(path);
}

export async function onGetBaseFolder(): Promise<string | null> {
  return readBaseFolder();
}

export async function onScanLibrary(): Promise<MP3LibraryScan> {
  const base = readBaseFolder();
  if (!base) throw new Error('Base folder not set');
  return library.scan(base);
}

export async function onFilterLibrary(include: string[] = [], exclude: string[] = []): Promise<MP3LibraryScan> {
  const scan = await onScanLibrary();
  const files = library.filterByTags(scan.files, include, exclude);
  const tags = Array.from(new Set(scan.tags));
  return { files, tags };
}

export async function onGetHistory(): Promise<MP3EditHistory[]> {
  return fetchHistory();
}

export async function onRevertHistory(id: number): Promise<void> {
  const history = fetchHistory().find(h => h.id === id);
  if (!history) throw new Error('History not found');
  await mp3Manager.writeComment(history.filePath, history.oldComment || '');
  markHistoryReverted(id);
}
