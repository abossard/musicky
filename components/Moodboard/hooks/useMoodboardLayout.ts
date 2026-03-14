import type { Node, Edge } from '@xyflow/react';

const SONG_SIZE = 140;
const TAG_HEIGHT = 50;

/**
 * Cluster layout: tags become cluster centers arranged in a circle,
 * songs are placed near the tags they're connected to.
 * Songs connected to multiple tags are positioned at the midpoint.
 */
export function applyClusterLayout(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  if (nodes.length === 0) return nodes;

  const tagNodes = nodes.filter(n => n.type === 'tag');
  const songNodes = nodes.filter(n => n.type === 'song');
  const unconnectedSongs: Node[] = [];
  const positions = new Map<string, { x: number; y: number }>();

  // 1. Arrange tags in a circle
  const centerX = 0;
  const centerY = 0;
  const tagRadius = Math.max(300, tagNodes.length * 80);

  tagNodes.forEach((tag, i) => {
    const angle = (2 * Math.PI * i) / Math.max(tagNodes.length, 1) - Math.PI / 2;
    positions.set(tag.id, {
      x: centerX + tagRadius * Math.cos(angle),
      y: centerY + tagRadius * Math.sin(angle),
    });
  });

  // 2. Build adjacency: song → connected tag IDs
  const songToTags = new Map<string, string[]>();
  for (const edge of edges) {
    // song→tag or tag→song
    const songId = songNodes.find(n => n.id === edge.source)?.id
      || songNodes.find(n => n.id === edge.target)?.id;
    const tagId = tagNodes.find(n => n.id === edge.source)?.id
      || tagNodes.find(n => n.id === edge.target)?.id;
    if (songId && tagId) {
      const existing = songToTags.get(songId) || [];
      if (!existing.includes(tagId)) existing.push(tagId);
      songToTags.set(songId, existing);
    }
  }

  // 3. Position songs near their connected tags
  // Group songs by their tag combination for spacing
  const tagGroupSongs = new Map<string, Node[]>();
  for (const song of songNodes) {
    const connectedTags = songToTags.get(song.id) || [];
    if (connectedTags.length === 0) {
      unconnectedSongs.push(song);
      continue;
    }
    const groupKey = connectedTags.sort().join(',');
    const existing = tagGroupSongs.get(groupKey) || [];
    existing.push(song);
    tagGroupSongs.set(groupKey, existing);
  }

  for (const [groupKey, songs] of tagGroupSongs) {
    const tagIds = groupKey.split(',');
    // Midpoint of connected tags
    let midX = 0, midY = 0;
    for (const tid of tagIds) {
      const tp = positions.get(tid);
      if (tp) { midX += tp.x; midY += tp.y; }
    }
    midX /= tagIds.length;
    midY /= tagIds.length;

    // Spread songs around the midpoint
    const spread = Math.max(SONG_SIZE, songs.length * 30);
    songs.forEach((song, i) => {
      const angle = (2 * Math.PI * i) / Math.max(songs.length, 1);
      const r = songs.length === 1 ? 0 : spread;
      positions.set(song.id, {
        x: midX + r * Math.cos(angle) - SONG_SIZE / 2,
        y: midY + r * Math.sin(angle) - SONG_SIZE / 2,
      });
    });
  }

  // 4. Place unconnected songs in a row below
  const bottomY = tagRadius + 200;
  unconnectedSongs.forEach((song, i) => {
    positions.set(song.id, {
      x: -300 + (i % 5) * (SONG_SIZE + 20),
      y: bottomY + Math.floor(i / 5) * (SONG_SIZE + 20),
    });
  });

  return nodes.map(node => {
    const pos = positions.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });
}

/**
 * Grid layout: arrange all songs in a grid, tags in a row below.
 */
export function applyGridLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  const songs = nodes.filter(n => n.type === 'song');
  const tags = nodes.filter(n => n.type === 'tag');
  const cols = Math.max(3, Math.ceil(Math.sqrt(songs.length)));
  const spacing = 180;

  const positioned = new Map<string, { x: number; y: number }>();

  songs.forEach((node, i) => {
    positioned.set(node.id, {
      x: (i % cols) * spacing,
      y: Math.floor(i / cols) * spacing,
    });
  });

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
