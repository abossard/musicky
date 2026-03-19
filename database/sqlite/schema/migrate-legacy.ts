import 'dotenv/config';
import { db } from '../db';

const client = db();

interface MoodboardNode {
  id: string;
  board_id: number;
  node_type: string;
  song_path: string | null;
  tag_label: string | null;
  tag_category: string | null;
  tag_color: string | null;
  position_x: number;
  position_y: number;
}

interface MoodboardEdge {
  id: string;
  board_id: number;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  weight: number;
  label: string | null;
}

interface DJSetRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface DJSetItemRow {
  id: number;
  set_id: number;
  file_path: string;
  position: number;
}

function tableExists(name: string): boolean {
  return !!client.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function tableCount(name: string): number {
  const row = client.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
  return row.count;
}

// Map old edge_type values to new connection_type enum values
function mapConnectionType(edgeType: string): string {
  switch (edgeType) {
    case 'similarity': return 'similarity';
    case 'transition': return 'transition';
    case 'remix': return 'remix';
    default: return 'custom';
  }
}

// Map old tag_category values to new enum, defaulting to 'custom'
function mapTagCategory(category: string | null): string {
  switch (category) {
    case 'genre': return 'genre';
    case 'phase': return 'phase';
    case 'mood': return 'mood';
    case 'topic': return 'topic';
    case 'custom': return 'custom';
    default: return 'custom';
  }
}

// ─── Moodboard → Canvas Positions + Song Tags + Song Connections ────────────

if (tableExists('moodboard_nodes') && tableExists('canvas_positions') && tableCount('canvas_positions') === 0) {
  console.log('[migrate-legacy] Migrating moodboard data...');

  const nodes = client.prepare('SELECT * FROM moodboard_nodes').all() as MoodboardNode[];
  const edges = client.prepare('SELECT * FROM moodboard_edges').all() as MoodboardEdge[];

  // Build a lookup map: node id → node row
  const nodeMap = new Map<string, MoodboardNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const migrate = client.transaction(() => {
    // Prepared statements for inserts
    const insertCanvasPos = client.prepare(
      `INSERT OR IGNORE INTO canvas_positions (node_id, position_x, position_y) VALUES (?, ?, ?)`
    );
    const insertSongTag = client.prepare(
      `INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?, ?, ?, 'manual')`
    );
    const insertConnection = client.prepare(
      `INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight, source) VALUES (?, ?, ?, ?, 'manual')`
    );

    let canvasCount = 0;
    let tagFromNodeCount = 0;
    let connectionCount = 0;
    let tagFromEdgeCount = 0;

    // 1. Migrate nodes → canvas_positions
    for (const node of nodes) {
      if (node.node_type === 'song' && node.song_path) {
        insertCanvasPos.run(`song:${node.song_path}`, node.position_x, node.position_y);
        canvasCount++;
      } else if (node.node_type === 'tag' && node.tag_label && node.tag_category) {
        insertCanvasPos.run(`tag:${node.tag_category}:${node.tag_label}`, node.position_x, node.position_y);
        canvasCount++;
      }
    }

    // 2. Migrate edges → song_connections or song_tags
    for (const edge of edges) {
      const source = nodeMap.get(edge.source_node_id);
      const target = nodeMap.get(edge.target_node_id);
      if (!source || !target) continue;

      if (source.node_type === 'song' && target.node_type === 'song') {
        // Song-to-song edge → song_connection
        if (source.song_path && target.song_path) {
          insertConnection.run(
            source.song_path,
            target.song_path,
            mapConnectionType(edge.edge_type),
            edge.weight
          );
          connectionCount++;
        }
      } else if (source.node_type === 'song' && target.node_type === 'tag') {
        // Song-to-tag edge → song_tag
        if (source.song_path && target.tag_label && target.tag_category) {
          insertSongTag.run(source.song_path, target.tag_label, mapTagCategory(target.tag_category));
          tagFromEdgeCount++;
        }
      } else if (source.node_type === 'tag' && target.node_type === 'song') {
        // Tag-to-song edge → song_tag (reverse direction)
        if (target.song_path && source.tag_label && source.tag_category) {
          insertSongTag.run(target.song_path, source.tag_label, mapTagCategory(source.tag_category));
          tagFromEdgeCount++;
        }
      }
    }

    console.log(`[migrate-legacy]   Canvas positions: ${canvasCount}`);
    console.log(`[migrate-legacy]   Song tags (from tag nodes): ${tagFromNodeCount}`);
    console.log(`[migrate-legacy]   Song tags (from edges): ${tagFromEdgeCount}`);
    console.log(`[migrate-legacy]   Song connections: ${connectionCount}`);
  });

  migrate();
  console.log('[migrate-legacy] Moodboard migration complete.');
} else if (!tableExists('moodboard_nodes')) {
  console.log('[migrate-legacy] No moodboard_nodes table found, skipping moodboard migration.');
} else {
  console.log('[migrate-legacy] canvas_positions already has data, skipping moodboard migration.');
}

// ─── DJ Sets → Playlists ────────────────────────────────────────────────────

if (tableExists('dj_sets') && tableExists('playlists') && tableCount('playlists') === 0) {
  console.log('[migrate-legacy] Migrating DJ sets → playlists...');

  const djSets = client.prepare('SELECT * FROM dj_sets').all() as DJSetRow[];

  const migrate = client.transaction(() => {
    const insertPlaylist = client.prepare(
      `INSERT OR IGNORE INTO playlists (name, description, generation_params) VALUES (?, ?, NULL)`
    );
    const insertPlaylistItem = client.prepare(
      `INSERT OR IGNORE INTO playlist_items (playlist_id, file_path, position) VALUES (?, ?, ?)`
    );

    let playlistCount = 0;
    let itemCount = 0;

    for (const djSet of djSets) {
      const result = insertPlaylist.run(djSet.name, djSet.description);
      const newPlaylistId = result.lastInsertRowid as number;
      playlistCount++;

      const items = client.prepare(
        'SELECT * FROM dj_set_items WHERE set_id = ? ORDER BY position'
      ).all(djSet.id) as DJSetItemRow[];

      for (const item of items) {
        insertPlaylistItem.run(newPlaylistId, item.file_path, item.position);
        itemCount++;
      }
    }

    console.log(`[migrate-legacy]   Playlists: ${playlistCount}`);
    console.log(`[migrate-legacy]   Playlist items: ${itemCount}`);
  });

  migrate();
  console.log('[migrate-legacy] DJ sets migration complete.');
} else if (!tableExists('dj_sets')) {
  console.log('[migrate-legacy] No dj_sets table found, skipping DJ sets migration.');
} else {
  console.log('[migrate-legacy] playlists already has data, skipping DJ sets migration.');
}
