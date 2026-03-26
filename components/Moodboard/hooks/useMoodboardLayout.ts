import type { Node, Edge } from '@xyflow/react';

const SONG_SIZE = 140;
const TAG_HEIGHT = 50;

// ---- helpers shared by layouts ----

/** Extract data field safely */
function nodeData(n: Node): Record<string, any> {
  return (n.data ?? {}) as Record<string, any>;
}

/**
 * Set Layout: phases form a horizontal timeline (left → right),
 * songs cluster around their phase, ordered by directional song→song edges,
 * with genre sub-groups huddling together.
 */
export function applySetLayout(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  if (nodes.length === 0) return nodes;

  const positions = new Map<string, { x: number; y: number }>();
  const songNodes = nodes.filter(n => n.type === 'song');
  const tagNodes = nodes.filter(n => n.type === 'tag');
  const phaseTags = tagNodes.filter(n => nodeData(n).category === 'phase');
  const genreTags = tagNodes.filter(n => nodeData(n).category === 'genre');
  const otherTags = tagNodes.filter(n => {
    const cat = nodeData(n).category;
    return cat !== 'phase' && cat !== 'genre';
  });

  // --- 1. Order phases left-to-right ---
  // Use song→song edges + phase edges to find a sensible left-to-right order.
  // Simple approach: topological sort of phase tags based on their phase_edge ordering,
  // fallback to the order they appear connected to songs from left-most song chains.
  const phaseOrder = orderPhases(phaseTags, songNodes, edges);

  const PHASE_SPACING = 700;
  const CENTER_Y = 0;
  const PHASE_Y = CENTER_Y - 100; // phases sit slightly above the center line

  phaseOrder.forEach((phaseNode, i) => {
    positions.set(phaseNode.id, {
      x: i * PHASE_SPACING,
      y: PHASE_Y,
    });
  });

  // --- 2. Assign songs to phases ---
  const songToPhase = new Map<string, string>(); // songId → phaseNodeId
  for (const edge of edges) {
    const srcSong = songNodes.find(n => n.id === edge.source);
    const tgtPhase = phaseTags.find(n => n.id === edge.target);
    if (srcSong && tgtPhase) { songToPhase.set(srcSong.id, tgtPhase.id); continue; }
    const tgtSong = songNodes.find(n => n.id === edge.target);
    const srcPhase = phaseTags.find(n => n.id === edge.source);
    if (tgtSong && srcPhase) { songToPhase.set(tgtSong.id, srcPhase.id); }
  }

  // Group songs by phase
  const phaseGroups = new Map<string, Node[]>();
  const unphased: Node[] = [];
  for (const song of songNodes) {
    const phaseId = songToPhase.get(song.id);
    if (phaseId) {
      const group = phaseGroups.get(phaseId) || [];
      group.push(song);
      phaseGroups.set(phaseId, group);
    } else {
      unphased.push(song);
    }
  }

  // --- 3. Build song→song directional graph for ordering within phase ---
  const songSuccessors = new Map<string, string[]>(); // songId → [successor songIds]
  for (const edge of edges) {
    const src = songNodes.find(n => n.id === edge.source);
    const tgt = songNodes.find(n => n.id === edge.target);
    if (src && tgt) {
      const succ = songSuccessors.get(src.id) || [];
      succ.push(tgt.id);
      songSuccessors.set(src.id, succ);
    }
  }

  // --- 4. Assign songs to genres for sub-clustering ---
  const songToGenre = new Map<string, string>(); // songId → genreTagId (first match)
  for (const edge of edges) {
    const srcSong = songNodes.find(n => n.id === edge.source);
    const tgtGenre = genreTags.find(n => n.id === edge.target);
    if (srcSong && tgtGenre && !songToGenre.has(srcSong.id)) {
      songToGenre.set(srcSong.id, tgtGenre.id);
      continue;
    }
    const tgtSong = songNodes.find(n => n.id === edge.target);
    const srcGenre = genreTags.find(n => n.id === edge.source);
    if (tgtSong && srcGenre && !songToGenre.has(tgtSong.id)) {
      songToGenre.set(tgtSong.id, srcGenre.id);
    }
  }

  // --- 5. Position songs within each phase group ---
  for (const phaseNode of phaseOrder) {
    const songs = phaseGroups.get(phaseNode.id) || [];
    if (songs.length === 0) continue;

    const phasePos = positions.get(phaseNode.id)!;
    const phaseX = phasePos.x;

    // Order songs by directional edges (topological sort within group)
    const ordered = topologicalSortSongs(songs, songSuccessors);

    // Sub-group by genre
    const genreSubGroups = new Map<string, Node[]>(); // genreId → songs
    const noGenre: Node[] = [];
    for (const song of ordered) {
      const gid = songToGenre.get(song.id);
      if (gid) {
        const g = genreSubGroups.get(gid) || [];
        g.push(song);
        genreSubGroups.set(gid, g);
      } else {
        noGenre.push(song);
      }
    }

    // Layout sub-groups vertically, spread horizontally within each
    const allSubGroups = [...genreSubGroups.entries(), ['__none__', noGenre] as [string, Node[]]];
    let yOffset = CENTER_Y + 40;
    const SUB_GROUP_GAP = 60;
    const SONG_SPACING_X = SONG_SIZE + 20;
    const SONG_SPACING_Y = SONG_SIZE + 30;

    for (const [genreId, groupSongs] of allSubGroups) {
      if (groupSongs.length === 0) continue;

      const cols = Math.max(1, Math.min(4, groupSongs.length));
      const groupWidth = cols * SONG_SPACING_X;
      const startX = phaseX - groupWidth / 2 + SONG_SPACING_X / 2;

      groupSongs.forEach((song, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.set(song.id, {
          x: startX + col * SONG_SPACING_X,
          y: yOffset + row * SONG_SPACING_Y,
        });
      });

      // Position genre tag at the center of its sub-group
      if (genreId !== '__none__') {
        const rows = Math.ceil(groupSongs.length / cols);
        positions.set(genreId, {
          x: phaseX,
          y: yOffset + rows * SONG_SPACING_Y + 10,
        });
      }

      const rows = Math.ceil(groupSongs.length / cols);
      yOffset += rows * SONG_SPACING_Y + SUB_GROUP_GAP;
    }
  }

  // --- 6. Position unphased songs to the right ---
  const unphasedX = phaseOrder.length * PHASE_SPACING;
  unphased.forEach((song, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    positions.set(song.id, {
      x: unphasedX + col * (SONG_SIZE + 20),
      y: CENTER_Y + 40 + row * (SONG_SIZE + 30),
    });
  });

  // --- 7. Position remaining tags (mood, topic, custom) near their connected songs ---
  for (const tag of otherTags) {
    const connectedSongs = edges
      .filter(e => e.source === tag.id || e.target === tag.id)
      .map(e => e.source === tag.id ? e.target : e.source)
      .map(id => positions.get(id))
      .filter(Boolean) as { x: number; y: number }[];

    if (connectedSongs.length > 0) {
      const avgX = connectedSongs.reduce((s, p) => s + p.x, 0) / connectedSongs.length;
      const avgY = connectedSongs.reduce((s, p) => s + p.y, 0) / connectedSongs.length;
      positions.set(tag.id, { x: avgX, y: avgY - 80 });
    }
  }

  // Position genre tags that weren't placed inside phase groups (no songs in any phase)
  let floatingGenreX = -300;
  for (const gt of genreTags) {
    if (!positions.has(gt.id)) {
      positions.set(gt.id, { x: floatingGenreX, y: CENTER_Y + 300 });
      floatingGenreX += 200;
    }
  }

  // Position other tags that have no connections
  let floatingOtherX = -300;
  for (const tag of otherTags) {
    if (!positions.has(tag.id)) {
      positions.set(tag.id, { x: floatingOtherX, y: CENTER_Y + 450 });
      floatingOtherX += 160;
    }
  }

  return nodes.map(node => {
    const pos = positions.get(node.id);
    return pos ? { ...node, position: pos } : node;
  });
}

/** Order phases left-to-right using song→song edge chains to infer flow direction. */
function orderPhases(phaseTags: Node[], songNodes: Node[], edges: Edge[]): Node[] {
  if (phaseTags.length <= 1) return phaseTags;

  // Build phase adjacency from song→song edges that cross phases
  const songPhase = new Map<string, string>();
  for (const e of edges) {
    const src = songNodes.find(n => n.id === e.source);
    const tgt = phaseTags.find(n => n.id === e.target);
    if (src && tgt) songPhase.set(src.id, tgt.id);
    const tgt2 = songNodes.find(n => n.id === e.target);
    const src2 = phaseTags.find(n => n.id === e.source);
    if (tgt2 && src2) songPhase.set(tgt2.id, src2.id);
  }

  // Count phase→phase transitions from song→song edges
  const phaseFlow = new Map<string, Map<string, number>>();
  for (const e of edges) {
    const srcSong = songNodes.find(n => n.id === e.source);
    const tgtSong = songNodes.find(n => n.id === e.target);
    if (!srcSong || !tgtSong) continue;
    const srcPhase = songPhase.get(srcSong.id);
    const tgtPhase = songPhase.get(tgtSong.id);
    if (srcPhase && tgtPhase && srcPhase !== tgtPhase) {
      const inner = phaseFlow.get(srcPhase) || new Map<string, number>();
      inner.set(tgtPhase, (inner.get(tgtPhase) || 0) + 1);
      phaseFlow.set(srcPhase, inner);
    }
  }

  // Topological sort based on flow counts
  const inDegree = new Map<string, number>();
  for (const p of phaseTags) inDegree.set(p.id, 0);
  for (const [, targets] of phaseFlow) {
    for (const [tgt] of targets) {
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    }
  }

  const sorted: Node[] = [];
  const queue = phaseTags.filter(p => (inDegree.get(p.id) || 0) === 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    // Pick node with lowest in-degree (stable sort by label for determinism)
    queue.sort((a, b) => (nodeData(a).label || '').localeCompare(nodeData(b).label || ''));
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    sorted.push(current);

    const targets = phaseFlow.get(current.id);
    if (targets) {
      for (const [tgtId] of targets) {
        inDegree.set(tgtId, (inDegree.get(tgtId) || 0) - 1);
        const tgtNode = phaseTags.find(p => p.id === tgtId);
        if (tgtNode && !visited.has(tgtId)) queue.push(tgtNode);
      }
    }
  }

  // Add any phases not reached by the sort (disconnected)
  for (const p of phaseTags) {
    if (!visited.has(p.id)) sorted.push(p);
  }

  return sorted;
}

/** Topological sort of songs within a phase group using directional edges. */
function topologicalSortSongs(songs: Node[], successors: Map<string, string[]>): Node[] {
  const songSet = new Set(songs.map(s => s.id));
  const inDegree = new Map<string, number>();
  for (const s of songs) inDegree.set(s.id, 0);

  for (const song of songs) {
    const succ = successors.get(song.id) || [];
    for (const t of succ) {
      if (songSet.has(t)) {
        inDegree.set(t, (inDegree.get(t) || 0) + 1);
      }
    }
  }

  const result: Node[] = [];
  const queue = songs.filter(s => (inDegree.get(s.id) || 0) === 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    result.push(current);

    const succ = successors.get(current.id) || [];
    for (const tId of succ) {
      if (songSet.has(tId) && !visited.has(tId)) {
        inDegree.set(tId, (inDegree.get(tId) || 0) - 1);
        if ((inDegree.get(tId) || 0) <= 0) {
          const node = songs.find(s => s.id === tId);
          if (node) queue.push(node);
        }
      }
    }
  }

  // Add unvisited (cycles or disconnected)
  for (const s of songs) {
    if (!visited.has(s.id)) result.push(s);
  }

  return result;
}

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
  const tagRadius = Math.max(400, tagNodes.length * 100);

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
    const spread = Math.max(SONG_SIZE + 20, songs.length * 40);
    songs.forEach((song, i) => {
      const angle = (2 * Math.PI * i) / Math.max(songs.length, 1) - Math.PI / 4;
      const r = songs.length === 1 ? 0 : spread;
      positions.set(song.id, {
        x: midX + r * Math.cos(angle),
        y: midY + r * Math.sin(angle),
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
