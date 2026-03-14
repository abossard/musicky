import { db } from '../db';

const client = db();

// --- Moodboard CRUD ---

export interface Moodboard {
  id: number;
  name: string;
  viewport_json: string | null;
  created_at: string;
  updated_at: string;
}

export function createMoodboard(name: string): Moodboard {
  const result = client.prepare('INSERT INTO moodboards (name) VALUES (?)').run(name);
  return getMoodboardById(result.lastInsertRowid as number)!;
}

export function getMoodboards(): Moodboard[] {
  return client.prepare('SELECT * FROM moodboards ORDER BY updated_at DESC').all() as Moodboard[];
}

export function getMoodboardById(id: number): Moodboard | null {
  return client.prepare('SELECT * FROM moodboards WHERE id = ?').get(id) as Moodboard | null;
}

export function updateMoodboardViewport(id: number, viewportJson: string): void {
  client.prepare('UPDATE moodboards SET viewport_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(viewportJson, id);
}

export function deleteMoodboard(id: number): void {
  client.prepare('DELETE FROM moodboards WHERE id = ?').run(id);
}

// --- Node CRUD ---

export interface MoodboardNodeRow {
  id: string;
  board_id: number;
  node_type: string;
  song_path: string | null;
  tag_label: string | null;
  tag_category: string | null;
  tag_color: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

export function getNodes(boardId: number): MoodboardNodeRow[] {
  return client.prepare('SELECT * FROM moodboard_nodes WHERE board_id = ?').all(boardId) as MoodboardNodeRow[];
}

export function upsertNode(node: {
  id: string;
  boardId: number;
  nodeType: string;
  songPath?: string | null;
  tagLabel?: string | null;
  tagCategory?: string | null;
  tagColor?: string | null;
  positionX: number;
  positionY: number;
}): void {
  client.prepare(`
    INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, tag_label, tag_category, tag_color, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET position_x = excluded.position_x, position_y = excluded.position_y
  `).run(node.id, node.boardId, node.nodeType, node.songPath ?? null, node.tagLabel ?? null, node.tagCategory ?? null, node.tagColor ?? null, node.positionX, node.positionY);
}

export function deleteNode(nodeId: string): void {
  client.prepare('DELETE FROM moodboard_edges WHERE source_node_id = ? OR target_node_id = ?').run(nodeId, nodeId);
  client.prepare('DELETE FROM moodboard_nodes WHERE id = ?').run(nodeId);
}

export function isSongOnBoard(boardId: number, songPath: string): boolean {
  const row = client.prepare('SELECT 1 FROM moodboard_nodes WHERE board_id = ? AND song_path = ? LIMIT 1').get(boardId, songPath);
  return !!row;
}

export function updateNodePosition(nodeId: string, x: number, y: number): void {
  client.prepare('UPDATE moodboard_nodes SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, nodeId);
}

export function bulkUpdatePositions(updates: { id: string; x: number; y: number }[]): void {
  const stmt = client.prepare('UPDATE moodboard_nodes SET position_x = ?, position_y = ? WHERE id = ?');
  const tx = client.transaction((items: { id: string; x: number; y: number }[]) => {
    for (const u of items) stmt.run(u.x, u.y, u.id);
  });
  tx(updates);
}

// --- Edge CRUD ---

export interface MoodboardEdgeRow {
  id: string;
  board_id: number;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  weight: number;
  label: string | null;
  created_at: string;
}

export function getEdges(boardId: number): MoodboardEdgeRow[] {
  return client.prepare('SELECT * FROM moodboard_edges WHERE board_id = ?').all(boardId) as MoodboardEdgeRow[];
}

export function upsertEdge(edge: {
  id: string;
  boardId: number;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  weight: number;
  label?: string | null;
}): void {
  client.prepare(`
    INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight, label)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET edge_type = excluded.edge_type, weight = excluded.weight, label = excluded.label
  `).run(edge.id, edge.boardId, edge.sourceNodeId, edge.targetNodeId, edge.edgeType, edge.weight, edge.label ?? null);
}

export function updateEdgeWeight(edgeId: string, weight: number): void {
  client.prepare('UPDATE moodboard_edges SET weight = ? WHERE id = ?').run(weight, edgeId);
}

export function deleteEdge(edgeId: string): void {
  client.prepare('DELETE FROM moodboard_edges WHERE id = ?').run(edgeId);
}

// --- Bulk save (full board state) ---

export function saveBoardState(boardId: number, nodes: { id: string; x: number; y: number }[], viewportJson: string): void {
  const tx = client.transaction(() => {
    const stmt = client.prepare('UPDATE moodboard_nodes SET position_x = ?, position_y = ? WHERE id = ? AND board_id = ?');
    for (const n of nodes) stmt.run(n.x, n.y, n.id, boardId);
    client.prepare('UPDATE moodboards SET viewport_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(viewportJson, boardId);
  });
  tx();
}
