-- Grid Library — Turso (libSQL) schema
-- This runs automatically on first API call (see netlify/functions/utils/db.js),
-- but you can also run it manually with the Turso CLI:
--   turso db shell <your-db-name> < db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cover TEXT,
  status TEXT NOT NULL, -- planned | playing | completed | dropped
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, game_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
