import { db } from '../db.js';
import {
  insertTagEdit,
  getTagEditsByStatus,
  getTagEditsByFile,
  updateTagEditStatus as updateTagEditStatusSql,
  deleteTagEdit,
  insertTagHistory,
  getTagHistory,
  markTagHistoryReverted as markTagHistoryRevertedSql,
} from '../schema/mp3-tag-edits.js';

export interface PendingTagEdit {
  id: number;
  filePath: string;
  fieldName: string;
  originalValue: string | null;
  newValue: string;
  direction: 'export' | 'import';
  createdAt: string;
  status: 'pending' | 'applied' | 'failed' | 'rejected';
}

export interface TagEditHistory {
  id: number;
  filePath: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  direction: string;
  appliedAt: string;
  reverted: boolean;
}

function mapRow(row: any): PendingTagEdit {
  return {
    id: row.id,
    filePath: row.file_path,
    fieldName: row.field_name,
    originalValue: row.original_value,
    newValue: row.new_value,
    direction: row.direction,
    createdAt: row.created_at,
    status: row.status,
  };
}

function mapHistoryRow(row: any): TagEditHistory {
  return {
    id: row.id,
    filePath: row.file_path,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    direction: row.direction,
    appliedAt: row.applied_at,
    reverted: Boolean(row.reverted),
  };
}

export function addTagEdit(
  filePath: string,
  fieldName: string,
  originalValue: string | null,
  newValue: string,
  direction: 'export' | 'import' = 'export'
): number {
  const stmt = db().prepare(insertTagEdit);
  const result = stmt.run(filePath, fieldName, originalValue, newValue, direction);
  return result.lastInsertRowid as number;
}

export function getPendingTagEdits(): PendingTagEdit[] {
  const stmt = db().prepare(getTagEditsByStatus);
  return (stmt.all('pending') as any[]).map(mapRow);
}

export function getTagEditsForFile(filePath: string): PendingTagEdit[] {
  const stmt = db().prepare(getTagEditsByFile);
  return (stmt.all(filePath) as any[]).map(mapRow);
}

export function getTagEditById(id: number): PendingTagEdit | null {
  const row = db().prepare(
    'SELECT id, file_path, field_name, original_value, new_value, direction, created_at, status FROM mp3_pending_tag_edits WHERE id = ?'
  ).get(id) as any;
  return row ? mapRow(row) : null;
}

export function updateTagEditStatus(id: number, status: 'pending' | 'applied' | 'failed' | 'rejected'): void {
  db().prepare(updateTagEditStatusSql).run(status, id);
}

export function removeTagEdit(id: number): void {
  db().prepare(deleteTagEdit).run(id);
}

export function bulkUpdateTagEditStatus(ids: number[], status: 'applied' | 'failed' | 'rejected'): void {
  const stmt = db().prepare(updateTagEditStatusSql);
  const tx = db().transaction((editIds: number[]) => {
    for (const id of editIds) stmt.run(status, id);
  });
  tx(ids);
}

export function addTagHistory(
  filePath: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string,
  direction: 'export' | 'import' = 'export'
): void {
  db().prepare(insertTagHistory).run(filePath, fieldName, oldValue, newValue, direction);
}

export function fetchTagHistory(): TagEditHistory[] {
  return (db().prepare(getTagHistory).all() as any[]).map(mapHistoryRow);
}

export function markTagHistoryReverted(id: number): void {
  db().prepare(markTagHistoryRevertedSql).run(id);
}

/**
 * Remove all pending tag edits for a file (used when regenerating diffs)
 */
export function clearPendingTagEditsForFile(filePath: string): void {
  db().prepare("DELETE FROM mp3_pending_tag_edits WHERE file_path = ? AND status = 'pending'").run(filePath);
}

/**
 * Remove all pending tag edits with a given direction (used before bulk re-generation)
 */
export function clearPendingTagEditsByDirection(direction: 'export' | 'import'): void {
  db().prepare("DELETE FROM mp3_pending_tag_edits WHERE direction = ? AND status = 'pending'").run(direction);
}
