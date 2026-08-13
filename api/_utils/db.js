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
        steam_id TEXT,
        avatar TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS library_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id TEXT NOT NULL,
        title TEXT NOT NULL,
        cover TEXT,
        status TEXT NOT NULL,
        rating TEXT,
        genres TEXT,
        released TEXT,
        catalog_rating REAL,
        completed_at TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, game_id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`
    ],
    'write'
  )
  // Migrations for tables created before these columns existed.
  for (const stmt of [
    'ALTER TABLE library_items ADD COLUMN rating TEXT',
    'ALTER TABLE library_items ADD COLUMN genres TEXT',
    'ALTER TABLE library_items ADD COLUMN released TEXT',
    'ALTER TABLE library_items ADD COLUMN catalog_rating REAL',
    'ALTER TABLE library_items ADD COLUMN completed_at TEXT',
    'ALTER TABLE library_items ADD COLUMN playtime_minutes INTEGER',
    'ALTER TABLE users ADD COLUMN steam_id TEXT',
    'ALTER TABLE users ADD COLUMN avatar TEXT',
    'ALTER TABLE users ADD COLUMN deal_threshold_percent INTEGER',
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notified_deals (
      user_id INTEGER NOT NULL,
      appid INTEGER NOT NULL,
      discount_percent INTEGER NOT NULL,
      notified_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, appid)
    )`
  ]) {
    try {
      await db.execute(stmt)
    } catch (e) {
      if (!/duplicate column/i.test(e.message || '')) throw e
    }
  }
  // Partial unique index — allows unlimited NULLs (password-only accounts)
  // while still preventing two accounts from linking the same Steam ID.
  try {
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id) WHERE steam_id IS NOT NULL')
  } catch (e) {
    console.error('Failed to create steam_id index:', e)
  }
  ensured = true
}
