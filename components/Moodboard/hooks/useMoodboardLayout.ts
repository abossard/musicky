import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

const SONG_WIDTH = 120;
const SONG_HEIGHT = 140; // 120 art + 20 label
const TAG_WIDTH = 120;
const TAG_HEIGHT = 40;

/**
 * Cluster layout: tag nodes become cluster centers, connected songs orbit them.
 * Uses dagre for hierarchical layout with tags as rank anchors.
 */
export function applyClusterLayout(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes — tags first (they anchor clusters)
  for (const node of nodes) {
    const isTag = node.type === 'tag';
    g.setNode(node.id, {
      width: isTag ? TAG_WIDTH : SONG_WIDTH,
      height: isTag ? TAG_HEIGHT : SONG_HEIGHT,
    });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: pos.x - (node.type === 'tag' ? TAG_WIDTH : SONG_WIDTH) / 2,
        y: pos.y - (node.type === 'tag' ? TAG_HEIGHT : SONG_HEIGHT) / 2,
      },
    };
  });
}

/**
 * Grid layout: arrange all nodes in a grid, songs first then tags.
 */
export function applyGridLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  const songs = nodes.filter(n => n.type === 'song');
  const tags = nodes.filter(n => n.type === 'tag');
  const cols = Math.max(3, Math.ceil(Math.sqrt(songs.length)));
  const spacing = 180;

  const positioned = new Map<string, { x: number; y: number }>();

  // Songs in grid
  songs.forEach((node, i) => {
    positioned.set(node.id, {
      x: (i % cols) * spacing,
      y: Math.floor(i / cols) * spacing,
    });
  });

  // Tags below songs
  const tagStartY = (Math.ceil(songs.length / cols) + 1) * spacing;
  tags.forEach((node, i) => {
    positioned.set(node.id, {
      x: i * 160,
      y: tagStartY,
    });
  });

  return nodes.map(node => {
    const pos = positioned.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });
}
