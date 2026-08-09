import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const VALID_STATUSES = ['planned', 'playing', 'completed', 'dropped']

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id, title, cover, status, genres, released, catalog_rating } = req.body || {}
  if (!game_id || !title || !status) return sendJson(res, 400, { error: 'game_id, title and status are required' })
  if (!VALID_STATUSES.includes(status)) return sendJson(res, 400, { error: 'Invalid status' })

  await ensureSchema()
  const db = getClient()

  const genresJson = Array.isArray(genres) && genres.length ? JSON.stringify(genres.slice(0, 3)) : null
  const releasedVal = released || null
  const catalogRatingVal = typeof catalog_rating === 'number' ? catalog_rating : null

  await db.execute({
    sql: `INSERT INTO library_items (user_id, game_id, title, cover, status, genres, released, catalog_rating, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, game_id) DO UPDATE SET
            status = excluded.status,
            title = excluded.title,
            cover = excluded.cover,
            genres = excluded.genres,
            released = excluded.released,
            catalog_rating = excluded.catalog_rating,
            updated_at = datetime('now')`,
    args: [user.id, String(game_id), title, cover || null, status, genresJson, releasedVal, catalogRatingVal]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })

  sendJson(res, 200, { item: result.rows[0] })
})
