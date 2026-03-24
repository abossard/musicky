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

export function updateEdgeType(edgeId: string, edgeType: string): void {
  client.prepare('UPDATE moodboard_edges SET edge_type = ? WHERE id = ?').run(edgeType, edgeId);
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

// --- Revision / Snapshot types ---

export interface MoodboardSnapshot {
  nodes: Array<{
    id: string;
    node_type: string;
    song_path: string | null;
    tag_label: string | null;
    tag_category: string | null;
    tag_color: string | null;
    position_x: number;
    position_y: number;
  }>;
  edges: Array<{
    id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: string;
    weight: number;
    label: string | null;
  }>;
  viewport: string | null;
}

export interface MoodboardRevisionRow {
  id: number;
  board_id: number;
  revision_number: number;
  snapshot_json: string;
  message: string | null;
  created_at: string;
}

export interface MoodboardRevisionSummary {
  id: number;
  revision_number: number;
  message: string | null;
  created_at: string;
  node_count: number;
  edge_count: number;
}

// --- Revision CRUD ---

export function createRevision(boardId: number, snapshotJson: string, message?: string): MoodboardRevisionRow {
  const maxRow = client.prepare(
    'SELECT COALESCE(MAX(revision_number), 0) AS max_rev FROM moodboard_revisions WHERE board_id = ?'
  ).get(boardId) as { max_rev: number };
  const nextRev = maxRow.max_rev + 1;

  const result = client.prepare(
    'INSERT INTO moodboard_revisions (board_id, revision_number, snapshot_json, message) VALUES (?, ?, ?, ?)'
  ).run(boardId, nextRev, snapshotJson, message ?? null);

  return client.prepare('SELECT * FROM moodboard_revisions WHERE id = ?').get(result.lastInsertRowid) as MoodboardRevisionRow;
}

export function getRevisions(boardId: number): MoodboardRevisionSummary[] {
  const rows = client.prepare(
    'SELECT id, revision_number, snapshot_json, message, created_at FROM moodboard_revisions WHERE board_id = ? ORDER BY revision_number DESC'
  ).all(boardId) as MoodboardRevisionRow[];

  return rows.map((r) => {
    const snapshot: MoodboardSnapshot = JSON.parse(r.snapshot_json);
    return {
      id: r.id,
      revision_number: r.revision_number,
      message: r.message,
      created_at: r.created_at,
      node_count: snapshot.nodes.length,
      edge_count: snapshot.edges.length,
    };
  });
}

export function getRevisionSnapshot(revisionId: number): MoodboardSnapshot | null {
  const row = client.prepare('SELECT snapshot_json FROM moodboard_revisions WHERE id = ?').get(revisionId) as { snapshot_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.snapshot_json) as MoodboardSnapshot;
}

export function restoreRevision(boardId: number, revisionId: number): void {
  const snapshot = getRevisionSnapshot(revisionId);
  if (!snapshot) throw new Error(`Revision ${revisionId} not found`);

  const tx = client.transaction(() => {
    client.prepare('DELETE FROM moodboard_edges WHERE board_id = ?').run(boardId);
    client.prepare('DELETE FROM moodboard_nodes WHERE board_id = ?').run(boardId);

    const nodeStmt = client.prepare(
      'INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const n of snapshot.nodes) {
      nodeStmt.run(n.id, boardId, n.node_type, n.song_path, n.tag_label, n.tag_category, n.tag_color, n.position_x, n.position_y);
    }

    const edgeStmt = client.prepare(
      'INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight, label) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const e of snapshot.edges) {
      edgeStmt.run(e.id, boardId, e.source_node_id, e.target_node_id, e.edge_type, e.weight, e.label);
    }

    if (snapshot.viewport !== undefined) {
      client.prepare('UPDATE moodboards SET viewport_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(snapshot.viewport, boardId);
    }
  });
  tx();
}

export function getRevisionCount(boardId: number): number {
  const row = client.prepare('SELECT COUNT(*) AS cnt FROM moodboard_revisions WHERE board_id = ?').get(boardId) as { cnt: number };
  return row.cnt;
}

export function buildSnapshot(boardId: number): MoodboardSnapshot {
  const board = getMoodboardById(boardId);
  const nodes = getNodes(boardId);
  const edges = getEdges(boardId);
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      node_type: n.node_type,
      song_path: n.song_path,
      tag_label: n.tag_label,
      tag_category: n.tag_category,
      tag_color: n.tag_color,
      position_x: n.position_x,
      position_y: n.position_y,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source_node_id: e.source_node_id,
      target_node_id: e.target_node_id,
      edge_type: e.edge_type,
      weight: e.weight,
      label: e.label,
    })),
    viewport: board?.viewport_json ?? null,
  };
}
