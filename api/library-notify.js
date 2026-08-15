import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id, notify } = req.body || {}
  if (!game_id || typeof notify !== 'boolean') {
    return sendJson(res, 400, { error: 'game_id and notify (boolean) are required' })
  }

  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: 'UPDATE library_items SET notify_deals = ? WHERE user_id = ? AND game_id = ?',
    args: [notify ? 1 : 0, user.id, String(game_id)]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, playtime_minutes, notify_deals, completed_at, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })
  if (!result.rows.length) return sendJson(res, 404, { error: 'Not in library' })

  sendJson(res, 200, { item: result.rows[0] })
})
