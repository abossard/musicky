import { db } from '../db';

const client = db();

client.exec(`
  CREATE TABLE IF NOT EXISTS phase_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_phase TEXT NOT NULL,
    to_phase TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_phase, to_phase)
  );
`);

client.exec(`CREATE INDEX IF NOT EXISTS idx_phase_edges_from ON phase_edges(from_phase);`);
client.exec(`CREATE INDEX IF NOT EXISTS idx_phase_edges_to ON phase_edges(to_phase);`);
