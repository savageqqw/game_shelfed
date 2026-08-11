import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id, genres, released, catalog_rating } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  await ensureSchema()
  const db = getClient()

  const genresJson = Array.isArray(genres) && genres.length ? JSON.stringify(genres.slice(0, 3)) : null
  const catalogRatingVal = typeof catalog_rating === 'number' ? catalog_rating : null

  await db.execute({
    sql: `UPDATE library_items SET genres = ?, released = ?, catalog_rating = ? WHERE user_id = ? AND game_id = ?`,
    args: [genresJson, released || null, catalogRatingVal, user.id, String(game_id)]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, completed_at, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })
  if (!result.rows[0]) return sendJson(res, 404, { error: 'Item not found in library' })

  sendJson(res, 200, { item: result.rows[0] })
})
