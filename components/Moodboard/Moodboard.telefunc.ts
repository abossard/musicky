import {
  createMoodboard, getMoodboards, getMoodboardById, updateMoodboardViewport, deleteMoodboard,
  getNodes, upsertNode, deleteNode, isSongOnBoard, bulkUpdatePositions,
  getEdges, upsertEdge, updateEdgeWeight, updateEdgeType, deleteEdge, saveBoardState,
  buildSnapshot, createRevision, getRevisions, getRevisionSnapshot, restoreRevision, getRevisionCount,
  type Moodboard, type MoodboardNodeRow, type MoodboardEdgeRow,
  type MoodboardRevisionSummary,
} from '../../database/sqlite/queries/moodboard';
import { searchMP3Cache, getMP3CacheByPath } from '../../database/sqlite/queries/dj-sets';

// --- Board CRUD ---

export async function onGetMoodboards(): Promise<Moodboard[]> {
  return getMoodboards();
}

export async function onCreateMoodboard(name: string): Promise<Moodboard> {
  return createMoodboard(name);
}

export async function onDeleteMoodboard(id: number): Promise<void> {
  deleteMoodboard(id);
}

// --- Load full board ---

export interface BoardState {
  board: Moodboard;
  nodes: MoodboardNodeRow[];
  edges: MoodboardEdgeRow[];
}

export async function onLoadBoard(boardId: number): Promise<BoardState | null> {
  const board = getMoodboardById(boardId);
  if (!board) return null;
  return {
    board,
    nodes: getNodes(boardId),
    edges: getEdges(boardId),
  };
}

// --- Save board positions + viewport ---

export async function onSaveBoard(
  boardId: number,
  nodePositions: { id: string; x: number; y: number }[],
  viewportJson: string
): Promise<void> {
  const snapshot = buildSnapshot(boardId);
  createRevision(boardId, JSON.stringify(snapshot));
  saveBoardState(boardId, nodePositions, viewportJson);
}

// --- Node operations ---

export async function onAddSongNode(
  boardId: number,
  songPath: string,
  posX: number,
  posY: number,
): Promise<{ success: boolean; nodeId?: string; error?: string }> {
  if (isSongOnBoard(boardId, songPath)) {
    return { success: false, error: 'Song already on this board' };
  }
  const nodeId = `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  upsertNode({
    id: nodeId,
    boardId,
    nodeType: 'song',
    songPath,
    positionX: posX,
    positionY: posY,
  });
  return { success: true, nodeId };
}

export async function onAddTagNode(
  boardId: number,
  label: string,
  category: string,
  color: string,
  posX: number,
  posY: number,
): Promise<string> {
  const nodeId = `tag-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  upsertNode({
    id: nodeId,
    boardId,
    nodeType: 'tag',
    tagLabel: label,
    tagCategory: category,
    tagColor: color,
    positionX: posX,
    positionY: posY,
  });
  return nodeId;
}

export async function onDeleteNode(nodeId: string): Promise<void> {
  deleteNode(nodeId);
}

export async function onBulkUpdatePositions(updates: { id: string; x: number; y: number }[]): Promise<void> {
  bulkUpdatePositions(updates);
}

// --- Edge operations ---

export async function onAddEdge(
  boardId: number,
  sourceId: string,
  targetId: string,
  edgeType: string,
  weight: number,
): Promise<string> {
  const edgeId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  upsertEdge({
    id: edgeId,
    boardId,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    edgeType,
    weight,
  });
  return edgeId;
}

export async function onUpdateEdgeWeight(edgeId: string, weight: number): Promise<void> {
  updateEdgeWeight(edgeId, weight);
}

export async function onUpdateEdgeType(edgeId: string, edgeType: string): Promise<void> {
  updateEdgeType(edgeId, edgeType);
}

export async function onDeleteEdge(edgeId: string): Promise<void> {
  deleteEdge(edgeId);
}

// --- Song search (reuse existing) ---

export async function onSearchSongs(query: string, limit: number = 30) {
  return searchMP3Cache(query.trim(), limit);
}

export async function onIsSongOnBoard(boardId: number, songPath: string): Promise<boolean> {
  return isSongOnBoard(boardId, songPath);
}

export async function onGetSongMetadata(filePath: string) {
  return getMP3CacheByPath(filePath);
}

// --- Revision operations ---

export async function onGetRevisions(boardId: number): Promise<MoodboardRevisionSummary[]> {
  return getRevisions(boardId);
}

export async function onRestoreRevision(boardId: number, revisionId: number): Promise<void> {
  restoreRevision(boardId, revisionId);
}

export async function onGetRevisionCount(boardId: number): Promise<number> {
  return getRevisionCount(boardId);
}

// --- Export / Import ---

export interface MoodboardExport {
  version: 1;
  type: 'musicky-moodboard';
  exportedAt: string;
  board: { name: string; viewport: string | null };
  nodes: { id: string; type: string; songPath?: string; tagLabel?: string; tagCategory?: string; tagColor?: string; x: number; y: number }[];
  edges: { id: string; source: string; target: string; type: string; weight: number; label?: string }[];
}

export async function onExportMoodboard(boardId: number): Promise<MoodboardExport | null> {
  const board = getMoodboardById(boardId);
  if (!board) return null;
  const nodes = getNodes(boardId);
  const edges = getEdges(boardId);
  return {
    version: 1,
    type: 'musicky-moodboard',
    exportedAt: new Date().toISOString(),
    board: { name: board.name, viewport: board.viewport_json },
    nodes: nodes.map(n => ({
      id: n.id, type: n.node_type,
      songPath: n.song_path ?? undefined,
      tagLabel: n.tag_label ?? undefined,
      tagCategory: n.tag_category ?? undefined,
      tagColor: n.tag_color ?? undefined,
      x: n.position_x, y: n.position_y,
    })),
    edges: edges.map(e => ({
      id: e.id, source: e.source_node_id, target: e.target_node_id,
      type: e.edge_type, weight: e.weight,
      label: e.label ?? undefined,
    })),
  };
}

export async function onImportMoodboard(data: MoodboardExport): Promise<{ boardId: number; nodesImported: number; edgesImported: number }> {
  const board = createMoodboard(data.board.name);
  if (data.board.viewport) {
    updateMoodboardViewport(board.id, data.board.viewport);
  }
  const oldToNew = new Map<string, string>();
  for (const node of data.nodes) {
    const newId = `${node.type}:${node.songPath || node.tagLabel || node.id}`;
    oldToNew.set(node.id, newId);
    upsertNode({
      id: newId, boardId: board.id, nodeType: node.type,
      positionX: node.x, positionY: node.y,
      songPath: node.songPath, tagLabel: node.tagLabel,
      tagCategory: node.tagCategory, tagColor: node.tagColor,
    });
  }
  let edgesImported = 0;
  for (const edge of data.edges) {
    const source = oldToNew.get(edge.source) ?? edge.source;
    const target = oldToNew.get(edge.target) ?? edge.target;
    upsertEdge({
      id: `e-${source}-${target}`, boardId: board.id,
      sourceNodeId: source, targetNodeId: target,
      edgeType: edge.type, weight: edge.weight, label: edge.label,
    });
    edgesImported++;
  }
  return { boardId: board.id, nodesImported: data.nodes.length, edgesImported };
}
