import { db } from '../db';
import * as queries from '../schema/song-connections';

const client = db();

export type ConnectionType = 'similarity' | 'transition' | 'remix' | 'custom';
export type ConnectionSource = 'manual' | 'id3_import' | 'auto_discovered';

export interface SongConnection {
  id: number;
  source_path: string;
  target_path: string;
  connection_type: ConnectionType;
  weight: number;
  source: ConnectionSource;
  created_at: string;
}

export interface ConnectedSong {
  file_path: string;
  connection_type: ConnectionType;
  weight: number;
  direction: 'outgoing' | 'incoming';
}

export function addSongConnection(
  sourcePath: string,
  targetPath: string,
  type: ConnectionType,
  weight: number = 1.0,
  source: ConnectionSource = 'manual'
): SongConnection | null {
  const result = client.prepare(queries.addSongConnection).run(sourcePath, targetPath, type, weight, source);
  const id = result.lastInsertRowid as number;
  return client.prepare(queries.getSongConnectionById).get(id) as SongConnection | null;
}

export function removeSongConnection(id: number): void {
  client.prepare(queries.removeSongConnection).run(id);
}

export function removeSongConnectionByPaths(sourcePath: string, targetPath: string, type: ConnectionType): void {
  client.prepare(queries.removeSongConnectionByPaths).run(sourcePath, targetPath, type);
}

export function updateConnectionWeight(id: number, weight: number): void {
  client.prepare(queries.updateConnectionWeight).run(weight, id);
}

export function getConnectionsForSong(filePath: string): SongConnection[] {
  return client.prepare(queries.getConnectionsForSong).all(filePath, filePath) as SongConnection[];
}

export function getOutgoingConnections(filePath: string): SongConnection[] {
  return client.prepare(queries.getOutgoingConnections).all(filePath) as SongConnection[];
}

export function getIncomingConnections(filePath: string): SongConnection[] {
  return client.prepare(queries.getIncomingConnections).all(filePath) as SongConnection[];
}

export function getConnectionBetween(pathA: string, pathB: string): SongConnection[] {
  return client.prepare(queries.getConnectionBetween).all(pathA, pathB, pathB, pathA) as SongConnection[];
}

export function getAllConnections(type?: ConnectionType): SongConnection[] {
  if (type) {
    return client.prepare(queries.getAllConnectionsByType).all(type) as SongConnection[];
  }
  return client.prepare(queries.getAllConnections).all() as SongConnection[];
}

export function bulkAddConnections(
  connections: { sourcePath: string; targetPath: string; type: ConnectionType; weight?: number; source?: ConnectionSource }[]
): void {
  const stmt = client.prepare(queries.addSongConnection);

  const transaction = client.transaction((items: typeof connections) => {
    for (const conn of items) {
      stmt.run(conn.sourcePath, conn.targetPath, conn.type, conn.weight ?? 1.0, conn.source ?? 'manual');
    }
  });

  transaction(connections);
}

export function getConnectedSongs(filePath: string): ConnectedSong[] {
  const outgoing = client.prepare(queries.getConnectedSongsOutgoing).all(filePath) as ConnectedSong[];
  const incoming = client.prepare(queries.getConnectedSongsIncoming).all(filePath) as ConnectedSong[];
  return [...outgoing, ...incoming];
}

export function clearConnectionsForSong(filePath: string): void {
  client.prepare(queries.clearConnectionsForSong).run(filePath, filePath);
}
