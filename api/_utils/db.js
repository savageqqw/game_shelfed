import { createClient } from '@libsql/client'

let client = null

export function getClient() {
  if (client) return client
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set. See README for setup.')
  }
  client = createClient({ url, authToken })
  return client
}

let ensured = false
export async function ensureSchema() {
  if (ensured) return
  const db = getClient()
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS library_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id TEXT NOT NULL,
        title TEXT NOT NULL,
        cover TEXT,
        status TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, game_id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`
    ],
    'write'
  )
  ensured = true
}
