import { db } from '../db';

const client = db();

client.exec(`
  CREATE TABLE IF NOT EXISTS canvas_positions (
    node_id TEXT PRIMARY KEY,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

client.exec(`
  CREATE TABLE IF NOT EXISTS canvas_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    viewport_json TEXT,
    view_mode TEXT DEFAULT 'free' CHECK(view_mode IN ('free', 'phase', 'genre', 'mood')),
    filter_json TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

client.exec(`
  INSERT OR IGNORE INTO canvas_state (id, viewport_json, view_mode)
  VALUES (1, '{"x":0,"y":0,"zoom":1}', 'free');
`);
