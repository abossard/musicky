import type { Node, Edge } from '@xyflow/react';
import type { ContainerNodeData } from '../nodes/ContainerNode';
import type { TagCategory } from '../moodboard-constants';
import type { ViewMode } from '../moodboard-constants';

const SONG_TILE = 150;
const PADDING = 80;
const HEADER = 80;
const COLS = 3;
const CONTAINER_GAP = 120;
const CONTAINER_COLS = 2;

/**
 * Pure calculation: transform flat nodes/edges into a container-grouped view.
 * When viewMode is 'free', returns null (caller should use original nodes/edges).
 */
export function transformToContainerView(
  nodes: Node[],
  edges: Edge[],
  viewMode: ViewMode,
): { viewNodes: Node[]; viewEdges: Edge[] } | null {
  if (viewMode === 'free') return null;

  const category = viewMode as TagCategory;
  const tagNodesOfCategory = nodes.filter(n => n.type === 'tag' && (n.data as any)?.category === category);
  const songNodes = nodes.filter(n => n.type === 'song');
  const otherTags = nodes.filter(n => n.type === 'tag' && (n.data as any)?.category !== category);

  // Build song→tag adjacency for this category
  const songToContainerTag = new Map<string, string>();
  for (const edge of edges) {
    const songId = songNodes.find(n => n.id === edge.source)?.id || songNodes.find(n => n.id === edge.target)?.id;
    const tagId = tagNodesOfCategory.find(n => n.id === edge.source)?.id || tagNodesOfCategory.find(n => n.id === edge.target)?.id;
    if (songId && tagId && !songToContainerTag.has(songId)) {
      songToContainerTag.set(songId, tagId);
    }
  }

  // Collect containers with their children
  const containerDefs: { id: string; tag: Node; children: Node[] }[] = [];
  for (const tag of tagNodesOfCategory) {
    const containerId = `container-${tag.id}`;
    const children = songNodes.filter(s => songToContainerTag.get(s.id) === tag.id);
    containerDefs.push({ id: containerId, tag, children });
  }

  // Add uncategorized
  const uncategorized = songNodes.filter(s => !songToContainerTag.has(s.id));
  if (uncategorized.length > 0) {
    containerDefs.push({
      id: 'container-uncategorized',
      tag: { id: 'uncategorized', data: { label: 'Uncategorized', category: 'custom', color: 'gray' } } as any,
      children: uncategorized,
    });
  }

  // Auto-layout containers in a grid
  const containerNodes: Node[] = [];
  const childrenByContainer = new Map<string, Node[]>();
  let containerX = 0;
  let containerY = 0;
  let maxHeightInRow = 0;

  containerDefs.forEach((def, idx) => {
    const cols = Math.min(COLS, Math.max(1, def.children.length));
    const rows = Math.max(1, Math.ceil(def.children.length / COLS));
    const w = cols * SONG_TILE + PADDING * 2;
    const h = HEADER + rows * SONG_TILE + PADDING;

    childrenByContainer.set(def.id, def.children);

    containerNodes.push({
      id: def.id,
      type: 'container',
      position: { x: containerX, y: containerY },
      draggable: true,
      selectable: false,
      dragHandle: '.container-drag-handle',
      data: {
        label: (def.tag.data as any)?.label || 'Tag',
        category: (def.tag.data as any)?.category || category,
        color: (def.tag.data as any)?.color || 'gray',
        childCount: def.children.length,
        width: w,
        height: h,
      } satisfies ContainerNodeData as any,
      style: { width: w, height: h },
      zIndex: -1,
    });

    maxHeightInRow = Math.max(maxHeightInRow, h);
    if ((idx + 1) % CONTAINER_COLS === 0) {
      containerX = 0;
      containerY += maxHeightInRow + CONTAINER_GAP;
      maxHeightInRow = 0;
    } else {
      containerX += w + CONTAINER_GAP;
    }
  });

  // Position song nodes at absolute coordinates overlapping their container
  const containerPositions = new Map<string, { x: number; y: number }>();
  containerNodes.forEach(c => containerPositions.set(c.id, c.position));

  const allChildNodes: Node[] = [];
  for (const [containerId, children] of childrenByContainer) {
    const cp = containerPositions.get(containerId) || { x: 0, y: 0 };
    children.forEach((song, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      allChildNodes.push({
        ...song,
        position: { x: cp.x + PADDING + col * SONG_TILE, y: cp.y + HEADER + PADDING + row * SONG_TILE },
        draggable: true,
        data: { ...song.data, filterState: 'normal' },
        zIndex: 200,
      });
    });
  }

  // Keep non-category tag nodes visible (pass through with minimal decoration)
  const otherTagNodes = otherTags.map(n => ({
    ...n,
    data: { ...n.data, filterState: 'normal' },
  }));

  const viewNodes = [...containerNodes, ...allChildNodes, ...otherTagNodes];

  // Only keep edges that don't connect to container-category tags
  const tagIdsInContainers = new Set(tagNodesOfCategory.map(t => t.id));
  const viewEdges = edges.filter(e => !tagIdsInContainers.has(e.source) && !tagIdsInContainers.has(e.target));

  return { viewNodes, viewEdges };
}
