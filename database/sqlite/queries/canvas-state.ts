import { db } from '../db';

const client = db();

// --- Interfaces ---

export interface CanvasPosition {
  node_id: string;
  position_x: number;
  position_y: number;
  updated_at: string;
}

export interface CanvasState {
  viewport_json: string;
  view_mode: 'free' | 'phase' | 'genre' | 'mood';
  filter_json: string | null;
  updated_at: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// --- Node Positions ---

export function getNodePosition(nodeId: string): CanvasPosition | null {
  return client.prepare('SELECT * FROM canvas_positions WHERE node_id = ?').get(nodeId) as CanvasPosition | null;
}

export function getAllNodePositions(): CanvasPosition[] {
  return client.prepare('SELECT * FROM canvas_positions').all() as CanvasPosition[];
}

export function setNodePosition(nodeId: string, x: number, y: number): void {
  client.prepare(`
    INSERT INTO canvas_positions (node_id, position_x, position_y, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(node_id) DO UPDATE SET position_x = excluded.position_x, position_y = excluded.position_y, updated_at = CURRENT_TIMESTAMP
  `).run(nodeId, x, y);
}

export function bulkUpdatePositions(positions: { nodeId: string; x: number; y: number }[]): void {
  const stmt = client.prepare(`
    INSERT INTO canvas_positions (node_id, position_x, position_y, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(node_id) DO UPDATE SET position_x = excluded.position_x, position_y = excluded.position_y, updated_at = CURRENT_TIMESTAMP
  `);
  const tx = client.transaction((items: { nodeId: string; x: number; y: number }[]) => {
    for (const p of items) stmt.run(p.nodeId, p.x, p.y);
  });
  tx(positions);
}

export function removeNodePosition(nodeId: string): void {
  client.prepare('DELETE FROM canvas_positions WHERE node_id = ?').run(nodeId);
}

export function clearAllPositions(): void {
  client.prepare('DELETE FROM canvas_positions').run();
}

// --- Canvas State (singleton, id=1) ---

export function getCanvasState(): CanvasState {
  return client.prepare('SELECT viewport_json, view_mode, filter_json, updated_at FROM canvas_state WHERE id = 1').get() as CanvasState;
}

export function setViewport(viewport: Viewport): void {
  client.prepare('UPDATE canvas_state SET viewport_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(JSON.stringify(viewport));
}

export function setViewMode(mode: 'free' | 'phase' | 'genre' | 'mood'): void {
  client.prepare('UPDATE canvas_state SET view_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(mode);
}

export function setFilters(filters: Record<string, unknown>): void {
  client.prepare('UPDATE canvas_state SET filter_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(JSON.stringify(filters));
}

export function getViewport(): Viewport {
  const row = client.prepare('SELECT viewport_json FROM canvas_state WHERE id = 1').get() as { viewport_json: string } | undefined;
  if (!row || !row.viewport_json) {
    return { x: 0, y: 0, zoom: 1 };
  }
  try {
    return JSON.parse(row.viewport_json) as Viewport;
  } catch {
    return { x: 0, y: 0, zoom: 1 };
  }
}

export function getViewMode(): string {
  const row = client.prepare('SELECT view_mode FROM canvas_state WHERE id = 1').get() as { view_mode: string } | undefined;
  return row?.view_mode ?? 'free';
}

// --- Node ID Helpers (pure functions, no DB access) ---

export function songNodeId(filePath: string): string {
  return `song:${filePath}`;
}

export function tagNodeId(category: string, label: string): string {
  return `tag:${category}:${label}`;
}

export function parseSongNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith('song:')) return null;
  return nodeId.slice(5);
}

export function parseTagNodeId(nodeId: string): { category: string; label: string } | null {
  if (!nodeId.startsWith('tag:')) return null;
  const rest = nodeId.slice(4);
  const idx = rest.indexOf(':');
  if (idx === -1) return null;
  return { category: rest.slice(0, idx), label: rest.slice(idx + 1) };
}
