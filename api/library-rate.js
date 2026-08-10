import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const VALID_RATINGS = ['like', 'dislike', 'mixed']

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id, rating } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })
  if (rating !== null && !VALID_RATINGS.includes(rating)) {
    return sendJson(res, 400, { error: 'Invalid rating' })
  }

  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: `UPDATE library_items SET rating = ?, updated_at = datetime('now') WHERE user_id = ? AND game_id = ?`,
    args: [rating, user.id, String(game_id)]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })
  if (!result.rows[0]) return sendJson(res, 404, { error: 'Item not found in library' })

  sendJson(res, 200, { item: result.rows[0] })
})
