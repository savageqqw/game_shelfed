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

const BASE_TABLES = [
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
]

// column -> ALTER statement, keyed by table
const COLUMN_MIGRATIONS = {
  library_items: {
    rating: 'ALTER TABLE library_items ADD COLUMN rating TEXT',
    genres: 'ALTER TABLE library_items ADD COLUMN genres TEXT',
    released: 'ALTER TABLE library_items ADD COLUMN released TEXT',
    catalog_rating: 'ALTER TABLE library_items ADD COLUMN catalog_rating REAL',
    completed_at: 'ALTER TABLE library_items ADD COLUMN completed_at TEXT',
    playtime_minutes: 'ALTER TABLE library_items ADD COLUMN playtime_minutes INTEGER',
    deal_threshold_percent: 'ALTER TABLE library_items ADD COLUMN deal_threshold_percent INTEGER'
  },
  users: {
    steam_id: 'ALTER TABLE users ADD COLUMN steam_id TEXT',
    avatar: 'ALTER TABLE users ADD COLUMN avatar TEXT',
    deal_threshold_percent: 'ALTER TABLE users ADD COLUMN deal_threshold_percent INTEGER'
  }
}

// table name -> CREATE statement, for tables added after initial launch
const EXTRA_TABLES = {
  push_subscriptions: `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  notified_deals: `CREATE TABLE IF NOT EXISTS notified_deals (
    user_id INTEGER NOT NULL,
    appid INTEGER NOT NULL,
    discount_percent INTEGER NOT NULL,
    notified_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, appid)
  )`,
  comments: `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`
}

const STEAM_ID_INDEX =
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id) WHERE steam_id IS NOT NULL'

let ensured = false

// Runs once per warm serverless instance. Instead of blindly attempting
// ~13 ALTER TABLE statements one request at a time (13 sequential
// round-trips to Turso -- the main source of slow first-loads on cold
// starts), this inspects the current schema with a handful of parallel
// PRAGMA/sqlite_master queries and then batches only the migrations that
// are actually missing into a single write round-trip.
export async function ensureSchema() {
  if (ensured) return
  const db = getClient()

  // Base tables must exist before we can introspect their columns.
  await db.batch(BASE_TABLES, 'write')

  const [usersCols, itemsCols, master] = await Promise.all([
    db.execute('PRAGMA table_info(users)'),
    db.execute('PRAGMA table_info(library_items)'),
    db.execute("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'index')")
  ])

  const haveUserCols = new Set(usersCols.rows.map((r) => r.name))
  const haveItemCols = new Set(itemsCols.rows.map((r) => r.name))
  const haveNames = new Set(master.rows.map((r) => r.name))

  const stmts = []

  for (const [col, stmt] of Object.entries(COLUMN_MIGRATIONS.library_items)) {
    if (!haveItemCols.has(col)) stmts.push(stmt)
  }
  for (const [col, stmt] of Object.entries(COLUMN_MIGRATIONS.users)) {
    if (!haveUserCols.has(col)) stmts.push(stmt)
  }
  for (const [table, stmt] of Object.entries(EXTRA_TABLES)) {
    if (!haveNames.has(table)) stmts.push(stmt)
  }
  // Partial unique index -- allows unlimited NULLs (password-only accounts)
  // while still preventing two accounts from linking the same Steam ID.
  // Only valid once users.steam_id exists, which BASE_TABLES already
  // guarantees for fresh databases and the migration above covers for old ones.
  if (!haveNames.has('idx_users_steam_id')) stmts.push(STEAM_ID_INDEX)

  if (stmts.length) {
    try {
      await db.batch(stmts, 'write')
    } catch (e) {
      // Fall back to one-by-one so a single failing statement (e.g. the
      // index racing a concurrent cold start) doesn't block the rest.
      for (const stmt of stmts) {
        try {
          await db.execute(stmt)
        } catch (err) {
          if (!/duplicate column|already exists/i.test(err.message || '')) throw err
        }
      }
    }
  }

  ensured = true
}
