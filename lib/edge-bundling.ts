import type { Node, Edge } from '@xyflow/react';
import type { BundleConfig } from '../components/Moodboard/moodboard-constants';
import { DEFAULT_BUNDLE_CONFIG } from '../components/Moodboard/moodboard-constants';

/**
 * Geometry info injected into each bundled edge's data.
 * The WeightedEdge component uses this to draw a 3-segment path
 * (stub → spine → tag entry) instead of a direct route.
 */
export interface BundleInfo {
  tagNodeId: string;
  fanIndex: number;         // 0..N-1 position in the fan
  fanSize: number;          // total edges in this fan
  spineX: number;           // spine anchor X (where stubs converge)
  spineY: number;           // spine anchor Y
  tagX: number;             // tag node center X
  tagY: number;             // tag node center Y
  stubOffset: number;       // perpendicular offset (px) for this edge's stub
}

/**
 * Detect high fan-out tag nodes and compute spine geometry for edge bundling.
 *
 * Returns a Map from edge ID → BundleInfo. Edges not in any bundle are absent.
 * Only song→tag edges with fan-out ≥ threshold are bundled.
 * Song↔song edges are never bundled.
 */
export function computeBundles(
  nodes: Node[],
  edges: Edge[],
  config?: Partial<BundleConfig>,
): Map<string, BundleInfo> {
  const cfg = { ...DEFAULT_BUNDLE_CONFIG, ...config };
  const result = new Map<string, BundleInfo>();

  if (!cfg.enabled || nodes.length === 0 || edges.length === 0) return result;

  // Build lookup: nodeId → node
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Identify tag nodes and song nodes
  const tagIds = new Set(nodes.filter(n => n.type === 'tag').map(n => n.id));
  const songIds = new Set(nodes.filter(n => n.type === 'song').map(n => n.id));

  // Group edges by their tag endpoint
  // Each group: tagNodeId → [{ edgeId, songNodeId }]
  const fanGroups = new Map<string, { edgeId: string; songNodeId: string }[]>();

  for (const edge of edges) {
    let tagId: string | null = null;
    let songId: string | null = null;

    if (tagIds.has(edge.target) && songIds.has(edge.source)) {
      tagId = edge.target;
      songId = edge.source;
    } else if (tagIds.has(edge.source) && songIds.has(edge.target)) {
      tagId = edge.source;
      songId = edge.target;
    }

    if (!tagId || !songId) continue; // Skip song↔song or tag↔tag edges

    const group = fanGroups.get(tagId) || [];
    group.push({ edgeId: edge.id, songNodeId: songId });
    fanGroups.set(tagId, group);
  }

  // Process each fan group that meets the threshold
  for (const [tagId, members] of fanGroups) {
    if (members.length < cfg.threshold) continue;

    const tagNode = nodeMap.get(tagId);
    if (!tagNode) continue;

    // Tag node center (approximate — ReactFlow positions are top-left)
    const tagCx = tagNode.position.x + ((tagNode.measured?.width ?? tagNode.width ?? 100) as number) / 2;
    const tagCy = tagNode.position.y + ((tagNode.measured?.height ?? tagNode.height ?? 40) as number) / 2;

    // Compute centroid of all connected song nodes
    let centroidX = 0, centroidY = 0;
    let validCount = 0;
    for (const m of members) {
      const songNode = nodeMap.get(m.songNodeId);
      if (!songNode) continue;
      const sx = songNode.position.x + ((songNode.measured?.width ?? songNode.width ?? 120) as number) / 2;
      const sy = songNode.position.y + ((songNode.measured?.height ?? songNode.height ?? 120) as number) / 2;
      centroidX += sx;
      centroidY += sy;
      validCount++;
    }
    if (validCount === 0) continue;
    centroidX /= validCount;
    centroidY /= validCount;

    // Direction vector: tag → centroid
    const dx = centroidX - tagCx;
    const dy = centroidY - tagCy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;

    // Spine point: tag center + spineDistance along direction
    const spineX = tagCx + dirX * cfg.spineDistance;
    const spineY = tagCy + dirY * cfg.spineDistance;

    // Perpendicular axis for fan-out (rotated 90°)
    const perpX = -dirY;
    const perpY = dirX;

    // Sort members by their angle relative to the spine direction
    // (so adjacent stubs correspond to spatially adjacent songs)
    const membersWithAngle = members.map(m => {
      const songNode = nodeMap.get(m.songNodeId);
      if (!songNode) return { ...m, angle: 0 };
      const sx = songNode.position.x + ((songNode.measured?.width ?? songNode.width ?? 120) as number) / 2;
      const sy = songNode.position.y + ((songNode.measured?.height ?? songNode.height ?? 120) as number) / 2;
      // Project song position onto perpendicular axis
      const projX = sx - spineX;
      const projY = sy - spineY;
      const angle = projX * perpX + projY * perpY;
      return { ...m, angle };
    });
    membersWithAngle.sort((a, b) => a.angle - b.angle);

    // Assign bundle info to each edge
    const fanSize = membersWithAngle.length;
    const center = (fanSize - 1) / 2;

    for (let i = 0; i < fanSize; i++) {
      const m = membersWithAngle[i];
      const stubOffset = (i - center) * cfg.stubSpacing;

      result.set(m.edgeId, {
        tagNodeId: tagId,
        fanIndex: i,
        fanSize,
        spineX,
        spineY,
        tagX: tagCx,
        tagY: tagCy,
        stubOffset,
      });
    }
  }

  return result;
}
