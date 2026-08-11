import { getClient } from './db.js'

const VALID_STATUSES = ['planned', 'playing', 'completed', 'dropped']

export { VALID_STATUSES }

// Inserts or updates a single library row for a user. completed_at is only
// stamped the first time a row transitions into the 'completed' status.
export async function upsertLibraryItem(userId, { gameId, title, cover, status, genres, released, catalogRating }) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`)
  const db = getClient()

  const genresJson = Array.isArray(genres) && genres.length ? JSON.stringify(genres.slice(0, 3)) : null
  const releasedVal = released || null
  const catalogRatingVal = typeof catalogRating === 'number' ? catalogRating : null

  await db.execute({
    sql: `INSERT INTO library_items (user_id, game_id, title, cover, status, genres, released, catalog_rating, completed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END, datetime('now'))
          ON CONFLICT(user_id, game_id) DO UPDATE SET
            status = excluded.status,
            title = excluded.title,
            cover = excluded.cover,
            genres = excluded.genres,
            released = excluded.released,
            catalog_rating = excluded.catalog_rating,
            completed_at = CASE
              WHEN excluded.status = 'completed' AND library_items.status != 'completed' THEN datetime('now')
              ELSE library_items.completed_at
            END,
            updated_at = datetime('now')`,
    args: [userId, String(gameId), title, cover || null, status, genresJson, releasedVal, catalogRatingVal, status]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, completed_at, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [userId, String(gameId)]
  })
  return result.rows[0]
}
