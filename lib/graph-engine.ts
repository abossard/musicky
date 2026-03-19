/**
 * Pure domain logic for building and querying a song relationship graph.
 * No database access, no side effects — operates on data structures passed in.
 */

export interface SongNode {
  filePath: string;
  title?: string;
  artist?: string;
  tags: { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[];
}

export interface SongEdge {
  sourceFilePath: string;
  targetFilePath: string;
  type: string;
  weight: number;
}

export interface SongGraph {
  nodes: Map<string, SongNode>;
  edges: SongEdge[];
  adjacency: Map<string, SongEdge[]>;
}

function tagKey(tag: { label: string; category: string }): string {
  return `${tag.category}:${tag.label}`;
}

function addToAdjacency(adj: Map<string, SongEdge[]>, filePath: string, edge: SongEdge): void {
  const list = adj.get(filePath);
  if (list) {
    list.push(edge);
  } else {
    adj.set(filePath, [edge]);
  }
}

/**
 * Build a graph from songs, their tags, and explicit connections.
 * Constructs bidirectional adjacency lists for efficient traversal.
 */
export function buildSongGraph(
  songs: SongNode[],
  connections: SongEdge[]
): SongGraph {
  const nodes = new Map<string, SongNode>();
  const adjacency = new Map<string, SongEdge[]>();

  for (const song of songs) {
    nodes.set(song.filePath, song);
    if (!adjacency.has(song.filePath)) {
      adjacency.set(song.filePath, []);
    }
  }

  for (const edge of connections) {
    addToAdjacency(adjacency, edge.sourceFilePath, edge);
    addToAdjacency(adjacency, edge.targetFilePath, edge);
  }

  return { nodes, edges: connections, adjacency };
}

/**
 * Find connected components (clusters of related songs).
 * Returns arrays of file paths, each array is one connected component.
 */
export function findConnectedComponents(graph: SongGraph): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const filePath of graph.nodes.keys()) {
    if (visited.has(filePath)) continue;

    const component: string[] = [];
    const queue: string[] = [filePath];
    visited.add(filePath);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const edges = graph.adjacency.get(current) ?? [];
      for (const edge of edges) {
        const neighbor =
          edge.sourceFilePath === current ? edge.targetFilePath : edge.sourceFilePath;
        if (!visited.has(neighbor) && graph.nodes.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Discover hidden connections: songs that share the same tag.
 * Returns new edges whose type matches the shared tag category.
 * Edges that already exist in `existingEdges` are excluded.
 *
 * @param options.minSharedTags - Minimum shared tags to create an edge (default 1)
 * @param options.categories - Only consider tags in these categories (default: all)
 */
export function discoverHiddenConnections(
  songs: SongNode[],
  existingEdges: SongEdge[],
  options?: { minSharedTags?: number; categories?: string[] }
): SongEdge[] {
  const minShared = options?.minSharedTags ?? 1;
  const categories = options?.categories
    ? new Set(options.categories)
    : null;

  const existingSet = new Set<string>();
  for (const e of existingEdges) {
    existingSet.add(`${e.sourceFilePath}\0${e.targetFilePath}\0${e.type}`);
    existingSet.add(`${e.targetFilePath}\0${e.sourceFilePath}\0${e.type}`);
  }

  // Index: tagKey → list of songs that have that tag
  const tagIndex = new Map<string, { song: SongNode; category: string }[]>();
  for (const song of songs) {
    for (const tag of song.tags) {
      if (categories && !categories.has(tag.category)) continue;
      const key = tagKey(tag);
      const list = tagIndex.get(key);
      if (list) {
        list.push({ song, category: tag.category });
      } else {
        tagIndex.set(key, [{ song, category: tag.category }]);
      }
    }
  }

  // For each pair of songs, count shared tags per category
  const pairMap = new Map<string, { categories: Map<string, number>; a: string; b: string }>();

  for (const entries of tagIndex.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i].song.filePath;
        const b = entries[j].song.filePath;
        if (a === b) continue;

        const pairKey = a < b ? `${a}\0${b}` : `${b}\0${a}`;
        const sortedA = a < b ? a : b;
        const sortedB = a < b ? b : a;
        const cat = entries[i].category;

        let pair = pairMap.get(pairKey);
        if (!pair) {
          pair = { categories: new Map(), a: sortedA, b: sortedB };
          pairMap.set(pairKey, pair);
        }
        pair.categories.set(cat, (pair.categories.get(cat) ?? 0) + 1);
      }
    }
  }

  const newEdges: SongEdge[] = [];

  for (const pair of pairMap.values()) {
    let totalShared = 0;
    for (const count of pair.categories.values()) {
      totalShared += count;
    }
    if (totalShared < minShared) continue;

    for (const [cat, count] of pair.categories) {
      const edgeKey = `${pair.a}\0${pair.b}\0${cat}`;
      if (existingSet.has(edgeKey)) continue;

      newEdges.push({
        sourceFilePath: pair.a,
        targetFilePath: pair.b,
        type: cat,
        weight: Math.min(count / 5, 1.0),
      });

      existingSet.add(edgeKey);
      existingSet.add(`${pair.b}\0${pair.a}\0${cat}`);
    }
  }

  return newEdges;
}

/**
 * Compute Jaccard similarity between two songs based on shared tags.
 * Returns 0.0 (no similarity) to 1.0 (identical tags).
 * Tag identity is determined by combining label + category.
 */
export function computeSimilarityScore(songA: SongNode, songB: SongNode): number {
  const setA = new Set(songA.tags.map(tagKey));
  const setB = new Set(songB.tags.map(tagKey));

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const key of setA) {
    if (setB.has(key)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find songs most similar to a given song, ranked by Jaccard similarity.
 * Returns up to `limit` results (default 10), excluding the target song itself.
 */
export function findSimilarSongs(
  targetFilePath: string,
  graph: SongGraph,
  limit = 10
): { filePath: string; score: number }[] {
  const target = graph.nodes.get(targetFilePath);
  if (!target) return [];

  const results: { filePath: string; score: number }[] = [];

  for (const [filePath, node] of graph.nodes) {
    if (filePath === targetFilePath) continue;
    const score = computeSimilarityScore(target, node);
    if (score > 0) {
      results.push({ filePath, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Get all songs reachable from a starting song within N hops.
 * Uses BFS. Returns a set of file paths (including the start).
 *
 * @param maxHops - Maximum traversal depth (default 2)
 */
export function getNeighborhood(
  graph: SongGraph,
  startFilePath: string,
  maxHops = 2
): Set<string> {
  const visited = new Set<string>();
  if (!graph.nodes.has(startFilePath)) return visited;

  const queue: { filePath: string; depth: number }[] = [
    { filePath: startFilePath, depth: 0 },
  ];
  visited.add(startFilePath);

  while (queue.length > 0) {
    const { filePath, depth } = queue.shift()!;
    if (depth >= maxHops) continue;

    const edges = graph.adjacency.get(filePath) ?? [];
    for (const edge of edges) {
      const neighbor =
        edge.sourceFilePath === filePath ? edge.targetFilePath : edge.sourceFilePath;
      if (!visited.has(neighbor) && graph.nodes.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ filePath: neighbor, depth: depth + 1 });
      }
    }
  }

  return visited;
}

/**
 * Find the shortest path between two songs using BFS.
 * Returns an array of file paths from `fromFilePath` to `toFilePath`,
 * or null if no path exists.
 */
export function findShortestPath(
  graph: SongGraph,
  fromFilePath: string,
  toFilePath: string
): string[] | null {
  if (!graph.nodes.has(fromFilePath) || !graph.nodes.has(toFilePath)) return null;
  if (fromFilePath === toFilePath) return [fromFilePath];

  const visited = new Set<string>([fromFilePath]);
  const parent = new Map<string, string>();
  const queue: string[] = [fromFilePath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const edges = graph.adjacency.get(current) ?? [];

    for (const edge of edges) {
      const neighbor =
        edge.sourceFilePath === current ? edge.targetFilePath : edge.sourceFilePath;
      if (visited.has(neighbor) || !graph.nodes.has(neighbor)) continue;

      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === toFilePath) {
        const path: string[] = [neighbor];
        let node = neighbor;
        while (parent.has(node)) {
          node = parent.get(node)!;
          path.push(node);
        }
        return path.reverse();
      }

      queue.push(neighbor);
    }
  }

  return null;
}

/**
 * Get the degree (number of connections) for each song in the graph.
 * Counts each edge once per endpoint it touches.
 */
export function getNodeDegrees(graph: SongGraph): Map<string, number> {
  const degrees = new Map<string, number>();

  for (const filePath of graph.nodes.keys()) {
    degrees.set(filePath, 0);
  }

  for (const edge of graph.edges) {
    if (degrees.has(edge.sourceFilePath)) {
      degrees.set(edge.sourceFilePath, degrees.get(edge.sourceFilePath)! + 1);
    }
    if (degrees.has(edge.targetFilePath)) {
      degrees.set(edge.targetFilePath, degrees.get(edge.targetFilePath)! + 1);
    }
  }

  return degrees;
}

/**
 * Filter a graph to only include songs matching a predicate.
 * Edges are retained only if both endpoints pass the predicate.
 * A new graph is returned; the original is not mutated.
 */
export function filterGraph(
  graph: SongGraph,
  predicate: (node: SongNode) => boolean
): SongGraph {
  const filteredSongs: SongNode[] = [];
  const kept = new Set<string>();

  for (const [filePath, node] of graph.nodes) {
    if (predicate(node)) {
      filteredSongs.push(node);
      kept.add(filePath);
    }
  }

  const filteredEdges = graph.edges.filter(
    (e) => kept.has(e.sourceFilePath) && kept.has(e.targetFilePath)
  );

  return buildSongGraph(filteredSongs, filteredEdges);
}
