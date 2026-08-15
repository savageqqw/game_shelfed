import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

// percent semantics for library_items.deal_threshold_percent:
//   null/undefined -> reset to the account-wide default threshold
//   0               -> mute deal notifications entirely for this game
//   1-90            -> a custom threshold just for this game
export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id } = req.body || {}
  let { percent } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  if (percent === undefined || percent === null || percent === '') {
    percent = null
  } else {
    percent = parseInt(percent, 10)
    if (!Number.isFinite(percent) || percent < 0 || percent > 90) {
      return sendJson(res, 400, { error: 'percent must be between 0 and 90' })
    }
  }

  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: 'UPDATE library_items SET deal_threshold_percent = ? WHERE user_id = ? AND game_id = ?',
    args: [percent, user.id, String(game_id)]
  })

  const result = await db.execute({
    sql: 'SELECT id, game_id, title, cover, status, rating, genres, released, catalog_rating, playtime_minutes, deal_threshold_percent, completed_at, updated_at FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })
  if (!result.rows.length) return sendJson(res, 404, { error: 'Not in library' })

  sendJson(res, 200, { item: result.rows[0] })
})
