/**
 * Core playlist generation algorithm.
 * Produces an ordered song list from the moodboard graph data using
 * phase ordering and greedy nearest-neighbor heuristics.
 *
 * Pure domain logic — no database access, no side effects.
 */

import type { SongNode, SongEdge, SongGraph } from './graph-engine';
import {
  buildSongGraph,
  findConnectedComponents,
  computeSimilarityScore,
} from './graph-engine';
import type { PhaseEdge } from './phase-graph';
import { getPhaseOrder, buildPhaseGraph, findLongestPath } from './phase-graph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaylistOptions {
  /** Use longest path through phase DAG instead of topological order */
  useLongestPath?: boolean;
  /** How much to weight mood similarity in intra-phase ordering (0-1) */
  moodWeight?: number;
  /** How much to weight direct connections in intra-phase ordering (0-1) */
  connectionWeight?: number;
  /** Maximum songs per phase (0 = unlimited) */
  maxPerPhase?: number;
  /** Include songs with no phase tag? If so, which position */
  untaggedPlacement?: 'start' | 'end' | 'distribute' | 'exclude';
}

export interface PlaylistEntry {
  filePath: string;
  phase: string | null;
  position: number;
  /** Why this song is at this position */
  reason: 'phase_order' | 'linked_cluster' | 'mood_similarity' | 'transition' | 'untagged';
}

export interface GeneratedPlaylist {
  entries: PlaylistEntry[];
  phases: string[];
  stats: {
    totalSongs: number;
    phaseCounts: Record<string, number>;
    untaggedCount: number;
    clusterCount: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get default playlist options */
export function defaultPlaylistOptions(): Required<PlaylistOptions> {
  return {
    useLongestPath: false,
    moodWeight: 0.6,
    connectionWeight: 0.4,
    maxPerPhase: 0,
    untaggedPlacement: 'end',
  };
}

/** Build a SongNode containing only mood tags — used for mood-only similarity. */
function moodOnlyNode(node: SongNode): SongNode {
  return {
    filePath: node.filePath,
    tags: node.tags.filter((t) => t.category === 'mood'),
  };
}

/** Compute a combined score between two songs using mood similarity + connection weight. */
function combinedScore(
  a: SongNode,
  b: SongNode,
  graph: SongGraph,
  moodWeight: number,
  connectionWeight: number,
): number {
  const moodSim = computeSimilarityScore(moodOnlyNode(a), moodOnlyNode(b));

  let connScore = 0;
  const edges = graph.adjacency.get(a.filePath) ?? [];
  for (const edge of edges) {
    const neighbor =
      edge.sourceFilePath === a.filePath ? edge.targetFilePath : edge.sourceFilePath;
    if (neighbor === b.filePath) {
      connScore = Math.max(connScore, edge.weight);
    }
  }

  return moodWeight * moodSim + connectionWeight * connScore;
}

/**
 * Greedy nearest-neighbor ordering within a set of songs.
 * Starts from `startNode` (or first song) and greedily picks the most similar
 * remaining song at each step.
 */
function greedyOrder(
  songs: SongNode[],
  graph: SongGraph,
  moodWeight: number,
  connectionWeight: number,
  startNode?: SongNode,
): SongNode[] {
  if (songs.length === 0) return [];

  const remaining = new Set(songs.map((s) => s.filePath));
  const ordered: SongNode[] = [];

  // Pick starting song
  let current: SongNode;
  if (startNode && remaining.has(startNode.filePath)) {
    current = startNode;
  } else if (startNode) {
    // Pick the song most similar to startNode
    let best: SongNode = songs[0];
    let bestScore = -1;
    for (const s of songs) {
      const score = combinedScore(startNode, s, graph, moodWeight, connectionWeight);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    current = best;
  } else {
    current = songs[0];
  }

  ordered.push(current);
  remaining.delete(current.filePath);

  while (remaining.size > 0) {
    let bestNext: SongNode | null = null;
    let bestScore = -1;

    for (const fp of remaining) {
      const node = graph.nodes.get(fp);
      if (!node) continue;
      const score = combinedScore(current, node, graph, moodWeight, connectionWeight);
      if (score > bestScore) {
        bestScore = score;
        bestNext = node;
      }
    }

    if (!bestNext) {
      // Fallback: pick any remaining song
      const nextFp = remaining.values().next().value!;
      bestNext = graph.nodes.get(nextFp) ?? songs.find((s) => s.filePath === nextFp)!;
    }

    ordered.push(bestNext);
    remaining.delete(bestNext.filePath);
    current = bestNext;
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Sort songs within a phase using the linked-cluster + mood algorithm */
export function sortSongsInPhase(
  phaseSongs: SongNode[],
  graph: SongGraph,
  lastSong?: SongNode,
): { sorted: SongNode[]; clusterCount: number } {
  if (phaseSongs.length === 0) return { sorted: [], clusterCount: 0 };

  // Build subgraph of just the phase songs
  const phaseFilePaths = new Set(phaseSongs.map((s) => s.filePath));
  const subEdges = graph.edges.filter(
    (e) => phaseFilePaths.has(e.sourceFilePath) && phaseFilePaths.has(e.targetFilePath),
  );
  const subGraph = buildSongGraph(phaseSongs, subEdges);

  // Find connected components
  const components = findConnectedComponents(subGraph);

  // Sort components by size descending
  components.sort((a, b) => b.length - a.length);

  const opts = defaultPlaylistOptions();
  const sorted: SongNode[] = [];
  let currentLast = lastSong;

  for (const component of components) {
    const componentSongs = component
      .map((fp) => subGraph.nodes.get(fp))
      .filter((n): n is SongNode => n !== undefined);

    const ordered = greedyOrder(
      componentSongs,
      subGraph,
      opts.moodWeight,
      opts.connectionWeight,
      currentLast,
    );

    sorted.push(...ordered);
    if (ordered.length > 0) {
      currentLast = ordered[ordered.length - 1];
    }
  }

  return { sorted, clusterCount: components.length };
}

/** Find the best transition song from one group to the next */
export function findTransitionSong(
  fromSongs: SongNode[],
  toSongs: SongNode[],
  graph: SongGraph,
): { from: string; to: string; score: number } | null {
  if (fromSongs.length === 0 || toSongs.length === 0) return null;

  let bestFrom = '';
  let bestTo = '';
  let bestScore = -1;

  for (const f of fromSongs) {
    for (const t of toSongs) {
      // Prefer direct connections, fall back to mood similarity
      let connScore = 0;
      const edges = graph.adjacency.get(f.filePath) ?? [];
      for (const edge of edges) {
        const neighbor =
          edge.sourceFilePath === f.filePath ? edge.targetFilePath : edge.sourceFilePath;
        if (neighbor === t.filePath) {
          connScore = Math.max(connScore, edge.weight);
        }
      }

      const moodSim = computeSimilarityScore(moodOnlyNode(f), moodOnlyNode(t));
      const score = 0.4 * moodSim + 0.6 * connScore;

      if (score > bestScore) {
        bestScore = score;
        bestFrom = f.filePath;
        bestTo = t.filePath;
      }
    }
  }

  return bestScore > 0 ? { from: bestFrom, to: bestTo, score: bestScore } : null;
}

/**
 * Generate an ordered playlist from the song graph and phase flow.
 *
 * Algorithm:
 * 1. Get phase order from phase DAG (topological sort or longest path)
 * 2. For each phase in order:
 *    a. Collect all songs tagged with this phase
 *    b. Find connected components among these songs (clusters of linked songs)
 *    c. Sort clusters by size (larger clusters first, they're more "central")
 *    d. Within each cluster, sort by mood similarity:
 *       - Pick the song most similar (by mood tags) to the last song in the playlist
 *       - Then greedily pick the next most similar, etc. (nearest-neighbor heuristic)
 *    e. Between clusters, pick a "transition" song:
 *       - The song in the next cluster most connected to the last song of previous cluster
 * 3. Handle untagged songs based on options.untaggedPlacement
 * 4. Assign positions (0-based)
 */
export function generatePlaylist(
  songs: SongNode[],
  connections: SongEdge[],
  phaseEdges: PhaseEdge[],
  options?: PlaylistOptions,
): GeneratedPlaylist {
  const opts: Required<PlaylistOptions> = { ...defaultPlaylistOptions(), ...options };
  const graph = buildSongGraph(songs, connections);

  // 1. Determine phase order
  let phases: string[];
  if (opts.useLongestPath && phaseEdges.length > 0) {
    const phaseGraph = buildPhaseGraph(phaseEdges);
    phases = findLongestPath(phaseGraph);
  } else {
    phases = phaseEdges.length > 0 ? getPhaseOrder(phaseEdges) : [];
  }

  // Bucket songs by their phase tag (first phase tag wins)
  const songsByPhase = new Map<string, SongNode[]>();
  const untagged: SongNode[] = [];

  for (const song of songs) {
    const phaseTag = song.tags.find((t) => t.category === 'phase');
    if (phaseTag) {
      const list = songsByPhase.get(phaseTag.label) ?? [];
      list.push(song);
      songsByPhase.set(phaseTag.label, list);
    } else {
      untagged.push(song);
    }
  }

  // Add phases that have songs but aren't in the DAG
  for (const phase of songsByPhase.keys()) {
    if (!phases.includes(phase)) {
      phases.push(phase);
    }
  }

  // 2. Build entries phase by phase
  const entries: PlaylistEntry[] = [];
  let totalClusterCount = 0;
  const phaseCounts: Record<string, number> = {};

  for (const phase of phases) {
    let phaseSongs = songsByPhase.get(phase) ?? [];
    if (phaseSongs.length === 0) continue;

    // Apply maxPerPhase limit
    if (opts.maxPerPhase > 0 && phaseSongs.length > opts.maxPerPhase) {
      // Keep the most connected songs
      phaseSongs = phaseSongs
        .map((s) => ({
          song: s,
          degree: (graph.adjacency.get(s.filePath) ?? []).length,
        }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, opts.maxPerPhase)
        .map((x) => x.song);
    }

    const lastSong =
      entries.length > 0
        ? graph.nodes.get(entries[entries.length - 1].filePath)
        : undefined;

    const { sorted, clusterCount } = sortSongsInPhase(phaseSongs, graph, lastSong);
    totalClusterCount += clusterCount;

    for (let i = 0; i < sorted.length; i++) {
      const isFirst = i === 0 && entries.length > 0;
      let reason: PlaylistEntry['reason'];

      if (isFirst && clusterCount > 1) {
        reason = 'transition';
      } else if (clusterCount > 1) {
        reason = 'linked_cluster';
      } else if (sorted.length > 1) {
        reason = 'mood_similarity';
      } else {
        reason = 'phase_order';
      }

      entries.push({
        filePath: sorted[i].filePath,
        phase,
        position: 0, // assigned later
        reason,
      });
    }

    phaseCounts[phase] = sorted.length;
  }

  // 3. Handle untagged songs
  if (opts.untaggedPlacement !== 'exclude' && untagged.length > 0) {
    const untaggedEntries: PlaylistEntry[] = untagged.map((s) => ({
      filePath: s.filePath,
      phase: null,
      position: 0,
      reason: 'untagged' as const,
    }));

    switch (opts.untaggedPlacement) {
      case 'start':
        entries.unshift(...untaggedEntries);
        break;
      case 'end':
        entries.push(...untaggedEntries);
        break;
      case 'distribute': {
        if (entries.length === 0) {
          entries.push(...untaggedEntries);
        } else {
          // Spread evenly between existing entries
          const gap = Math.max(1, Math.floor(entries.length / (untaggedEntries.length + 1)));
          let insertOffset = 0;
          for (let i = 0; i < untaggedEntries.length; i++) {
            const pos = Math.min(gap * (i + 1) + insertOffset, entries.length);
            entries.splice(pos, 0, untaggedEntries[i]);
            insertOffset++;
          }
        }
        break;
      }
    }
  }

  // 4. Assign final positions
  for (let i = 0; i < entries.length; i++) {
    entries[i].position = i;
  }

  return {
    entries,
    phases,
    stats: {
      totalSongs: entries.length,
      phaseCounts,
      untaggedCount: untagged.length,
      clusterCount: totalClusterCount,
    },
  };
}

/** Shuffle songs within a specific phase, keeping other phases in order */
export function shuffleWithinPhase(
  playlist: GeneratedPlaylist,
  phase: string,
): GeneratedPlaylist {
  const newEntries = [...playlist.entries];

  // Find indices belonging to the target phase
  const phaseIndices: number[] = [];
  for (let i = 0; i < newEntries.length; i++) {
    if (newEntries[i].phase === phase) {
      phaseIndices.push(i);
    }
  }

  if (phaseIndices.length <= 1) {
    return { ...playlist, entries: newEntries };
  }

  // Collect the entries to shuffle
  const toShuffle = phaseIndices.map((i) => newEntries[i]);

  // Fisher-Yates shuffle
  for (let i = toShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
  }

  // Place shuffled entries back
  for (let k = 0; k < phaseIndices.length; k++) {
    newEntries[phaseIndices[k]] = toShuffle[k];
  }

  // Reassign positions
  for (let i = 0; i < newEntries.length; i++) {
    newEntries[i] = { ...newEntries[i], position: i };
  }

  return { ...playlist, entries: newEntries };
}

/** Insert a song at a specific position, shifting others */
export function insertSong(
  playlist: GeneratedPlaylist,
  filePath: string,
  position: number,
  phase?: string,
): GeneratedPlaylist {
  const newEntries = [...playlist.entries];
  const clampedPos = Math.max(0, Math.min(position, newEntries.length));

  const entry: PlaylistEntry = {
    filePath,
    phase: phase ?? null,
    position: clampedPos,
    reason: phase ? 'phase_order' : 'untagged',
  };

  newEntries.splice(clampedPos, 0, entry);

  // Reassign positions
  for (let i = 0; i < newEntries.length; i++) {
    newEntries[i] = { ...newEntries[i], position: i };
  }

  // Update stats
  const newPhaseCounts = { ...playlist.stats.phaseCounts };
  if (phase) {
    newPhaseCounts[phase] = (newPhaseCounts[phase] ?? 0) + 1;
  }

  return {
    ...playlist,
    entries: newEntries,
    stats: {
      ...playlist.stats,
      totalSongs: newEntries.length,
      phaseCounts: newPhaseCounts,
      untaggedCount: playlist.stats.untaggedCount + (phase ? 0 : 1),
    },
  };
}

/** Remove a song from the playlist */
export function removeSong(
  playlist: GeneratedPlaylist,
  filePath: string,
): GeneratedPlaylist {
  const removed = playlist.entries.find((e) => e.filePath === filePath);
  const newEntries = playlist.entries.filter((e) => e.filePath !== filePath);

  // Reassign positions
  for (let i = 0; i < newEntries.length; i++) {
    newEntries[i] = { ...newEntries[i], position: i };
  }

  const newPhaseCounts = { ...playlist.stats.phaseCounts };
  if (removed?.phase && newPhaseCounts[removed.phase] !== undefined) {
    newPhaseCounts[removed.phase] = Math.max(0, newPhaseCounts[removed.phase] - 1);
  }

  return {
    ...playlist,
    entries: newEntries,
    stats: {
      ...playlist.stats,
      totalSongs: newEntries.length,
      phaseCounts: newPhaseCounts,
      untaggedCount: playlist.stats.untaggedCount - (removed && !removed.phase ? 1 : 0),
    },
  };
}
