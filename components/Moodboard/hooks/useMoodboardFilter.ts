import type { Node, Edge } from '@xyflow/react';

export type FilterState = 'normal' | 'primary' | 'secondary' | 'hidden';

/**
 * Pure calculation: compute filter state for each node and edge.
 * Primary = songs connected to ALL active filter tags
 * Secondary = songs connected to primary songs via song→song edges
 * Hidden = everything else
 */
export function computeFilterStates(
  nodes: Node[],
  edges: Edge[],
  activeFilterTags: Set<string>,
): { nodeStates: Map<string, FilterState>; edgeStates: Map<string, FilterState> } {
  const nodeStates = new Map<string, FilterState>();
  const edgeStates = new Map<string, FilterState>();

  if (activeFilterTags.size === 0) {
    for (const n of nodes) nodeStates.set(n.id, 'normal');
    for (const e of edges) edgeStates.set(e.id, 'normal');
    return { nodeStates, edgeStates };
  }

  // Build song→connected-tags adjacency
  const songToTags = new Map<string, Set<string>>();
  for (const edge of edges) {
    const songId = nodes.find(n => n.id === edge.source && n.type === 'song')?.id
      || nodes.find(n => n.id === edge.target && n.type === 'song')?.id;
    const tagId = nodes.find(n => n.id === edge.source && n.type === 'tag')?.id
      || nodes.find(n => n.id === edge.target && n.type === 'tag')?.id;
    if (songId && tagId) {
      const set = songToTags.get(songId) || new Set();
      set.add(tagId);
      songToTags.set(songId, set);
    }
  }

  // Primary = connected to ALL active tags
  const primarySongIds = new Set<string>();
  for (const [songId, connectedTags] of songToTags) {
    if ([...activeFilterTags].every(t => connectedTags.has(t))) {
      primarySongIds.add(songId);
    }
  }

  // Secondary = songs connected to primary songs via song→song edges
  const secondarySongIds = new Set<string>();
  for (const edge of edges) {
    const srcSong = nodes.find(n => n.id === edge.source && n.type === 'song');
    const tgtSong = nodes.find(n => n.id === edge.target && n.type === 'song');
    if (srcSong && tgtSong) {
      if (primarySongIds.has(srcSong.id) && !primarySongIds.has(tgtSong.id)) secondarySongIds.add(tgtSong.id);
      if (primarySongIds.has(tgtSong.id) && !primarySongIds.has(srcSong.id)) secondarySongIds.add(srcSong.id);
    }
  }

  // Compute node states
  for (const n of nodes) {
    if (n.type === 'tag') {
      nodeStates.set(n.id, activeFilterTags.has(n.id) ? 'primary' : 'normal');
    } else {
      nodeStates.set(n.id, primarySongIds.has(n.id) ? 'primary'
        : secondarySongIds.has(n.id) ? 'secondary'
        : 'hidden');
    }
  }

  // Compute edge states
  for (const e of edges) {
    const srcPrimary = primarySongIds.has(e.source) || activeFilterTags.has(e.source);
    const tgtPrimary = primarySongIds.has(e.target) || activeFilterTags.has(e.target);
    const srcSecondary = secondarySongIds.has(e.source);
    const tgtSecondary = secondarySongIds.has(e.target);
    const fs: FilterState = (srcPrimary && tgtPrimary) ? 'primary'
      : (srcPrimary && tgtSecondary) || (srcSecondary && tgtPrimary) ? 'secondary'
      : 'hidden';
    edgeStates.set(e.id, fs);
  }

  return { nodeStates, edgeStates };
}
