import { db } from '../db';

const client = db();

client.exec(`
  CREATE TABLE IF NOT EXISTS moodboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    viewport_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

client.exec(`
  CREATE TABLE IF NOT EXISTS moodboard_nodes (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL,
    node_type TEXT NOT NULL,
    song_path TEXT,
    tag_label TEXT,
    tag_category TEXT,
    tag_color TEXT,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES moodboards(id) ON DELETE CASCADE
  );
`);

client.exec(`
  CREATE TABLE IF NOT EXISTS moodboard_edges (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    edge_type TEXT NOT NULL DEFAULT 'custom',
    weight REAL DEFAULT 1.0,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES moodboards(id) ON DELETE CASCADE,
    FOREIGN KEY (source_node_id) REFERENCES moodboard_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES moodboard_nodes(id) ON DELETE CASCADE
  );
`);

client.exec(`CREATE INDEX IF NOT EXISTS idx_moodboard_nodes_board ON moodboard_nodes(board_id);`);
client.exec(`CREATE INDEX IF NOT EXISTS idx_moodboard_edges_board ON moodboard_edges(board_id);`);
client.exec(`CREATE INDEX IF NOT EXISTS idx_moodboard_nodes_song ON moodboard_nodes(board_id, song_path);`);

client.exec(`
  CREATE TABLE IF NOT EXISTS moodboard_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    revision_number INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES moodboards(id) ON DELETE CASCADE,
    UNIQUE(board_id, revision_number)
  );
`);
client.exec(`CREATE INDEX IF NOT EXISTS idx_revisions_board ON moodboard_revisions(board_id, revision_number);`);
