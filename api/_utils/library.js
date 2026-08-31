import { getClient } from './db.js'

const VALID_STATUSES = ['planned', 'playing', 'completed', 'dropped']

export { VALID_STATUSES }

// Inserts or updates a single library row for a user. completed_at is only
// stamped the first time a row transitions into the 'completed' status.
// playtimeMinutes is only ever set on insert/update when a caller passes a
// real number (Steam import) -- omitting it (manual catalog adds) leaves
// whatever was already stored untouched instead of wiping it to NULL.
export async function upsertLibraryItem(userId, { gameId, title, cover, status, genres, released, catalogRating, playtimeMinutes }) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`)
  const db = getClient()

  const genresJson = Array.isArray(genres) && genres.length ? JSON.stringify(genres.slice(0, 3)) : null
  const releasedVal = released || null
  const catalogRatingVal = typeof catalogRating === 'number' ? catalogRating : null
  const hasPlaytime = typeof playtimeMinutes === 'number' && Number.isFinite(playtimeMinutes)
  const playtimeVal = hasPlaytime ? Math.round(playtimeMinutes) : null

  const result = await db.execute({
    sql: `INSERT INTO library_items (user_id, game_id, title, cover, status, genres, released, catalog_rating, playtime_minutes, completed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END, datetime('now'))
          ON CONFLICT(user_id, game_id) DO UPDATE SET
            status = excluded.status,
            title = excluded.title,
            cover = excluded.cover,
            genres = excluded.genres,
            released = excluded.released,
            catalog_rating = excluded.catalog_rating,
            playtime_minutes = CASE WHEN ? THEN excluded.playtime_minutes ELSE library_items.playtime_minutes END,
            completed_at = CASE
              WHEN excluded.status = 'completed' AND library_items.status != 'completed' THEN datetime('now')
              ELSE library_items.completed_at
            END,
            updated_at = datetime('now')
          RETURNING id, game_id, title, cover, status, rating, genres, released, catalog_rating, playtime_minutes, deal_threshold_percent, completed_at, updated_at`,
    args: [userId, String(gameId), title, cover || null, status, genresJson, releasedVal, catalogRatingVal, playtimeVal, status, hasPlaytime ? 1 : 0]
  })
  return result.rows[0]
}
