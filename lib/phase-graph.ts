/**
 * Pure domain logic for working with the phase flow DAG (directed acyclic graph).
 * Phases represent stages in a DJ set (e.g., "opener", "buildup", "peak", "cooldown", "closer")
 * and have directed edges defining the flow between them.
 *
 * No database access, no side effects — all functions operate on data structures passed in.
 */

export interface PhaseEdge {
  fromPhase: string;
  toPhase: string;
  weight: number;
}

export interface PhaseNode {
  name: string;
  songCount: number;
}

export interface PhaseGraph {
  phases: string[];
  edges: PhaseEdge[];
  adjacency: Map<string, PhaseEdge[]>;
  reverseAdj: Map<string, PhaseEdge[]>;
}

/**
 * Build a PhaseGraph from a list of edges.
 * Extracts all unique phase names and builds forward/reverse adjacency maps.
 */
export function buildPhaseGraph(edges: PhaseEdge[]): PhaseGraph {
  const phaseSet = new Set<string>();
  const adjacency = new Map<string, PhaseEdge[]>();
  const reverseAdj = new Map<string, PhaseEdge[]>();

  for (const edge of edges) {
    phaseSet.add(edge.fromPhase);
    phaseSet.add(edge.toPhase);

    const fwd = adjacency.get(edge.fromPhase) ?? [];
    fwd.push(edge);
    adjacency.set(edge.fromPhase, fwd);

    const rev = reverseAdj.get(edge.toPhase) ?? [];
    rev.push(edge);
    reverseAdj.set(edge.toPhase, rev);
  }

  return {
    phases: Array.from(phaseSet).sort(),
    edges,
    adjacency,
    reverseAdj,
  };
}

/**
 * Topological sort using Kahn's algorithm (BFS-based).
 * Returns an ordered array of phase names, or null if a cycle is detected.
 */
export function topologicalSort(graph: PhaseGraph): string[] | null {
  const inDegree = new Map<string, number>();
  for (const phase of graph.phases) {
    inDegree.set(phase, 0);
  }
  for (const edge of graph.edges) {
    inDegree.set(edge.toPhase, (inDegree.get(edge.toPhase) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [phase, deg] of inDegree) {
    if (deg === 0) queue.push(phase);
  }
  queue.sort();

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const edge of graph.adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(edge.toPhase) ?? 1) - 1;
      inDegree.set(edge.toPhase, newDeg);
      if (newDeg === 0) {
        queue.push(edge.toPhase);
        queue.sort();
      }
    }
  }

  return result.length === graph.phases.length ? result : null;
}

/**
 * Validate that the graph formed by the given edges is a DAG (no cycles).
 * Returns `{ valid: true }` if acyclic, or `{ valid: false, cycle }` with
 * a list of phase names forming the cycle.
 */
export function validateDAG(edges: PhaseEdge[]): { valid: boolean; cycle?: string[] } {
  const graph = buildPhaseGraph(edges);
  const sorted = topologicalSort(graph);
  if (sorted !== null) {
    return { valid: true };
  }

  // Find a cycle using DFS
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  for (const phase of graph.phases) {
    color.set(phase, WHITE);
    parent.set(phase, null);
  }

  function dfsCycle(node: string): string[] | null {
    color.set(node, GRAY);
    for (const edge of graph.adjacency.get(node) ?? []) {
      const neighbor = edge.toPhase;
      if (color.get(neighbor) === GRAY) {
        // Found cycle — reconstruct it
        const cycle: string[] = [neighbor, node];
        let cur = node;
        while (parent.get(cur) != null && parent.get(cur) !== neighbor) {
          cur = parent.get(cur)!;
          cycle.push(cur);
        }
        cycle.reverse();
        return cycle;
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, node);
        const result = dfsCycle(neighbor);
        if (result) return result;
      }
    }
    color.set(node, BLACK);
    return null;
  }

  for (const phase of graph.phases) {
    if (color.get(phase) === WHITE) {
      const cycle = dfsCycle(phase);
      if (cycle) return { valid: false, cycle };
    }
  }

  return { valid: false, cycle: [] };
}

/**
 * Check if adding an edge from `fromPhase` to `toPhase` would create a cycle.
 * Builds a temporary graph with the new edge and checks for cycles.
 */
export function wouldCreateCycle(edges: PhaseEdge[], fromPhase: string, toPhase: string): boolean {
  // Self-loop is always a cycle
  if (fromPhase === toPhase) return true;

  // Adding fromPhase→toPhase creates a cycle iff toPhase can already reach fromPhase
  const graph = buildPhaseGraph(edges);
  const visited = new Set<string>();
  const queue = [toPhase];
  visited.add(toPhase);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromPhase) return true;
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!visited.has(edge.toPhase)) {
        visited.add(edge.toPhase);
        queue.push(edge.toPhase);
      }
    }
  }

  return false;
}

/**
 * Get the ordered phase sequence via topological sort with weight-based tie-breaking.
 * When multiple phases could come next (same topological level), prefer those
 * reachable via higher-weight edges first.
 */
export function getPhaseOrder(edges: PhaseEdge[]): string[] {
  const graph = buildPhaseGraph(edges);

  const inDegree = new Map<string, number>();
  for (const phase of graph.phases) {
    inDegree.set(phase, 0);
  }
  for (const edge of graph.edges) {
    inDegree.set(edge.toPhase, (inDegree.get(edge.toPhase) ?? 0) + 1);
  }

  // Compute a weight score for each phase: max weight of any incoming edge
  const maxIncomingWeight = new Map<string, number>();
  for (const phase of graph.phases) {
    const incoming = graph.reverseAdj.get(phase) ?? [];
    const maxW = incoming.reduce((max, e) => Math.max(max, e.weight), 0);
    maxIncomingWeight.set(phase, maxW);
  }

  // Priority: higher incoming weight → earlier (for tie-breaking among same-level nodes)
  // Sources (no incoming edges) are sorted alphabetically
  const ready: string[] = [];
  for (const [phase, deg] of inDegree) {
    if (deg === 0) ready.push(phase);
  }
  ready.sort((a, b) => {
    const wa = maxIncomingWeight.get(a) ?? 0;
    const wb = maxIncomingWeight.get(b) ?? 0;
    if (wb !== wa) return wb - wa;
    return a.localeCompare(b);
  });

  const result: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift()!;
    result.push(current);

    const outgoing = graph.adjacency.get(current) ?? [];
    // Sort outgoing by weight descending so higher-weight successors are freed first
    const sorted = [...outgoing].sort((a, b) => b.weight - a.weight);

    for (const edge of sorted) {
      const newDeg = (inDegree.get(edge.toPhase) ?? 1) - 1;
      inDegree.set(edge.toPhase, newDeg);
      if (newDeg === 0) {
        ready.push(edge.toPhase);
        // Re-sort by max incoming weight (descending), then alphabetically
        ready.sort((a, b) => {
          const wa = maxIncomingWeight.get(a) ?? 0;
          const wb = maxIncomingWeight.get(b) ?? 0;
          if (wb !== wa) return wb - wa;
          return a.localeCompare(b);
        });
      }
    }
  }

  return result;
}

/**
 * Get possible next phases from the current phase, sorted by weight descending.
 */
export function getNextPhases(graph: PhaseGraph, currentPhase: string): { phase: string; weight: number }[] {
  const outgoing = graph.adjacency.get(currentPhase) ?? [];
  return outgoing
    .map((e) => ({ phase: e.toPhase, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get possible previous phases leading to the current phase, sorted by weight descending.
 */
export function getPreviousPhases(graph: PhaseGraph, currentPhase: string): { phase: string; weight: number }[] {
  const incoming = graph.reverseAdj.get(currentPhase) ?? [];
  return incoming
    .map((e) => ({ phase: e.fromPhase, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Get source phases — phases with no incoming edges (starting points).
 */
export function getSourcePhases(graph: PhaseGraph): string[] {
  return graph.phases.filter(
    (p) => (graph.reverseAdj.get(p) ?? []).length === 0
  );
}

/**
 * Get sink phases — phases with no outgoing edges (ending points).
 */
export function getSinkPhases(graph: PhaseGraph): string[] {
  return graph.phases.filter(
    (p) => (graph.adjacency.get(p) ?? []).length === 0
  );
}

const MAX_PATHS = 100;

/**
 * Find all paths through the phase graph from source phases (no incoming edges)
 * to sink phases (no outgoing edges) using DFS. Limited to 100 paths max.
 */
export function findAllPaths(graph: PhaseGraph): string[][] {
  const sources = getSourcePhases(graph);
  const sinkSet = new Set(getSinkPhases(graph));
  const paths: string[][] = [];

  function dfs(current: string, path: string[], visited: Set<string>): void {
    if (paths.length >= MAX_PATHS) return;

    path.push(current);
    visited.add(current);

    const outgoing = graph.adjacency.get(current) ?? [];
    if (outgoing.length === 0 || sinkSet.has(current) && outgoing.length === 0) {
      // Reached a sink — record the path
      paths.push([...path]);
    } else {
      for (const edge of outgoing) {
        if (!visited.has(edge.toPhase) && paths.length < MAX_PATHS) {
          dfs(edge.toPhase, path, visited);
        }
      }
      // If we visited neighbors but none were unvisited, and current is a sink, record it
      // (handled above since sinks have no outgoing edges)
    }

    path.pop();
    visited.delete(current);
  }

  for (const source of sources) {
    if (paths.length >= MAX_PATHS) break;
    dfs(source, [], new Set());
  }

  return paths;
}

/**
 * Find the longest path through the DAG using dynamic programming.
 * Useful for playlist generation — gives the most comprehensive phase sequence.
 */
export function findLongestPath(graph: PhaseGraph): string[] {
  const sorted = topologicalSort(graph);
  if (!sorted || sorted.length === 0) return [];

  // dist[phase] = length of longest path ending at phase
  const dist = new Map<string, number>();
  const predecessor = new Map<string, string | null>();

  for (const phase of sorted) {
    dist.set(phase, 0);
    predecessor.set(phase, null);
  }

  for (const u of sorted) {
    for (const edge of graph.adjacency.get(u) ?? []) {
      const v = edge.toPhase;
      const newDist = (dist.get(u) ?? 0) + 1;
      if (newDist > (dist.get(v) ?? 0)) {
        dist.set(v, newDist);
        predecessor.set(v, u);
      }
    }
  }

  // Find the node with the maximum distance
  let maxDist = -1;
  let endNode = sorted[0];
  for (const [phase, d] of dist) {
    if (d > maxDist) {
      maxDist = d;
      endNode = phase;
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = endNode;
  while (current !== null) {
    path.push(current);
    current = predecessor.get(current) ?? null;
  }
  path.reverse();

  return path;
}

// Known phase ordering hints for suggestDefaultFlow
const PHASE_ORDER_HINTS: Record<string, number> = {
  opener: 0,
  intro: 0,
  warmup: 1,
  'warm-up': 1,
  buildup: 2,
  'build-up': 2,
  build: 2,
  peak: 3,
  drop: 3,
  main: 3,
  cooldown: 4,
  'cool-down': 4,
  breakdown: 4,
  closer: 5,
  outro: 5,
  ending: 5,
};

/**
 * Suggest a default phase flow from a list of phase names.
 * Uses common DJ set ordering heuristics:
 * - opener/intro < warmup < buildup < peak/drop < cooldown/breakdown < closer/outro
 * - Unknown phases are placed in the middle (level 3).
 */
export function suggestDefaultFlow(phaseNames: string[]): PhaseEdge[] {
  if (phaseNames.length <= 1) return [];

  const getOrder = (name: string): number => {
    const lower = name.toLowerCase();
    if (PHASE_ORDER_HINTS[lower] !== undefined) return PHASE_ORDER_HINTS[lower];
    // Check partial matches
    for (const [hint, order] of Object.entries(PHASE_ORDER_HINTS)) {
      if (lower.includes(hint) || hint.includes(lower)) return order;
    }
    return 3; // Unknown phases go in the middle
  };

  const sorted = [...phaseNames].sort((a, b) => {
    const orderDiff = getOrder(a) - getOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b);
  });

  const edges: PhaseEdge[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    // Avoid duplicate edges if two phases have the same name
    if (sorted[i] !== sorted[i + 1]) {
      edges.push({
        fromPhase: sorted[i],
        toPhase: sorted[i + 1],
        weight: 1.0,
      });
    }
  }

  return edges;
}
