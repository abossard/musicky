import { db } from '../db';

const client = db();

export interface PhaseEdge {
  id: number;
  from_phase: string;
  to_phase: string;
  weight: number;
  created_at: string;
}

export function getPhaseEdges(): PhaseEdge[] {
  return client.prepare('SELECT * FROM phase_edges ORDER BY created_at DESC').all() as PhaseEdge[];
}

export function addPhaseEdge(fromPhase: string, toPhase: string, weight: number = 1.0): PhaseEdge {
  const result = client.prepare(
    'INSERT INTO phase_edges (from_phase, to_phase, weight) VALUES (?, ?, ?)'
  ).run(fromPhase, toPhase, weight);
  return client.prepare('SELECT * FROM phase_edges WHERE id = ?').get(result.lastInsertRowid as number) as PhaseEdge;
}

export function removePhaseEdge(id: number): void {
  client.prepare('DELETE FROM phase_edges WHERE id = ?').run(id);
}

export function updatePhaseEdgeWeight(id: number, weight: number): void {
  client.prepare('UPDATE phase_edges SET weight = ? WHERE id = ?').run(weight, id);
}

export function getEdgesFromPhase(fromPhase: string): PhaseEdge[] {
  return client.prepare('SELECT * FROM phase_edges WHERE from_phase = ?').all(fromPhase) as PhaseEdge[];
}

export function getEdgesToPhase(toPhase: string): PhaseEdge[] {
  return client.prepare('SELECT * FROM phase_edges WHERE to_phase = ?').all(toPhase) as PhaseEdge[];
}

export function getAllPhases(): string[] {
  const rows = client.prepare(
    'SELECT from_phase AS phase FROM phase_edges UNION SELECT to_phase AS phase FROM phase_edges ORDER BY phase'
  ).all() as { phase: string }[];
  return rows.map(r => r.phase);
}

export function wouldCreateCycle(fromPhase: string, toPhase: string): boolean {
  // Adding edge fromPhase -> toPhase creates a cycle if toPhase can already reach fromPhase
  const edges = client.prepare('SELECT from_phase, to_phase FROM phase_edges').all() as { from_phase: string; to_phase: string }[];

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from_phase) ?? [];
    neighbors.push(edge.to_phase);
    adjacency.set(edge.from_phase, neighbors);
  }

  // BFS from toPhase; if we can reach fromPhase, adding the edge would create a cycle
  const visited = new Set<string>();
  const queue = [toPhase];
  visited.add(toPhase);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromPhase) return true;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}
