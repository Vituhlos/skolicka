import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/skolicka.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Wraps better-sqlite3 in a pg-compatible async pool interface.
// Converts $1, $2, ... placeholders to ? and routes SELECT/RETURNING to .all(), others to .run().
export function createPool(db) {
  function query(sql, params = []) {
    const normalized = sql.replace(/\$\d+/g, '?');
    const upper = normalized.trimStart().toUpperCase();
    const stmt = db.prepare(normalized);

    if (upper.startsWith('SELECT') || /\bRETURNING\b/i.test(normalized)) {
      return Promise.resolve({ rows: stmt.all(...params) });
    } else {
      const info = stmt.run(...params);
      return Promise.resolve({ rows: [], rowCount: info.changes });
    }
  }

  return { query, _db: db };
}
