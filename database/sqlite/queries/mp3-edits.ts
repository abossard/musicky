import { db } from "../db.js";
import {
  insertPendingEdit,
  getPendingEdits,
  getAllPendingEdits as getAllPendingEditsQuery,
  updateEditStatus,
  deletePendingEdit,
  updatePendingEdit
} from "../schema/mp3-edits.js";
import type { PendingEdit } from "../../../lib/mp3-metadata.js";

const getEditByIdSql =
  "SELECT id, file_path, original_comment, new_comment, created_at, status FROM mp3_pending_edits WHERE id = ?";

export function addPendingEdit(
  filePath: string,
  originalComment: string | null,
  newComment: string
): void {
  const stmt = db().prepare(insertPendingEdit);
  stmt.run(filePath, originalComment, newComment);
}

export function getAllPendingEdits(): PendingEdit[] {
  const stmt = db().prepare(getAllPendingEditsQuery);
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    filePath: row.file_path,
    originalComment: row.original_comment,
    newComment: row.new_comment,
    createdAt: row.created_at,
    status: row.status
  }));
}

export function updatePendingEditStatus(id: number, status: 'pending' | 'applied' | 'failed'): void {
  const stmt = db().prepare(updateEditStatus);
  stmt.run(status, id);
}

export function removePendingEdit(id: number): void {
  const stmt = db().prepare(deletePendingEdit);
  stmt.run(id);
}

export function modifyPendingEdit(id: number, newComment: string): void {
  const stmt = db().prepare(updatePendingEdit);
  stmt.run(newComment, id);
}

export function getPendingEditById(id: number): PendingEdit | null {
  const stmt = db().prepare(getEditByIdSql);
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    filePath: row.file_path,
    originalComment: row.original_comment,
    newComment: row.new_comment,
    createdAt: row.created_at,
    status: row.status
  };
}
