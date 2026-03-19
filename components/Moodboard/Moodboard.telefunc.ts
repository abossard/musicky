import {
  createMoodboard, getMoodboards, getMoodboardById, updateMoodboardViewport, deleteMoodboard,
  getNodes, upsertNode, deleteNode, isSongOnBoard, bulkUpdatePositions,
  getEdges, upsertEdge, updateEdgeWeight, updateEdgeType, deleteEdge, saveBoardState,
  type Moodboard, type MoodboardNodeRow, type MoodboardEdgeRow,
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
