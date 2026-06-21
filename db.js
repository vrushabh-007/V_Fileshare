// db.js
const Database = require('better-sqlite3');
const db = new Database('filesharing.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    code TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    downloads INTEGER DEFAULT 0
  )
`);

module.exports = db;
