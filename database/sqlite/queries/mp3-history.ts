import { db } from '../db.js';
import { insertHistory, getHistory, markReverted } from '../schema/mp3-history.js';
import type { MP3EditHistory } from '../../../lib/mp3-library.js';

export function addHistory(filePath: string, oldComment: string | null, newComment: string): void {
  const stmt = db().prepare(insertHistory);
  stmt.run(filePath, oldComment, newComment);
}

export function fetchHistory(): MP3EditHistory[] {
  const stmt = db().prepare(getHistory);
  const rows = stmt.all() as any[];
  return rows.map(r => ({
    id: r.id,
    filePath: r.file_path,
    oldComment: r.old_comment,
    newComment: r.new_comment,
    appliedAt: r.applied_at,
    reverted: Boolean(r.reverted)
  }));
}

export function markHistoryReverted(id: number): void {
  const stmt = db().prepare(markReverted);
  stmt.run(id);
}
