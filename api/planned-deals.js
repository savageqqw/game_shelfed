import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { findDeals } from './_utils/deals.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  await ensureSchema()
  const db = getClient()

  const userRow = await db.execute({ sql: 'SELECT deal_threshold_percent FROM users WHERE id = ?', args: [user.id] })
  const threshold = userRow.rows[0]?.deal_threshold_percent ?? 20

  const planned = await db.execute({
    sql: "SELECT game_id, title, cover, deal_threshold_percent FROM library_items WHERE user_id = ? AND status = 'planned'",
    args: [user.id]
  })

  // deal_threshold_percent per game: NULL -> use account default, 0 -> muted
  // (skip entirely), 1-90 -> custom threshold just for that game.
  const items = planned.rows
    .filter((r) => r.deal_threshold_percent !== 0)
    .map((r) => ({
      game_id: r.game_id,
      title: r.title,
      cover: r.cover,
      threshold: r.deal_threshold_percent ?? threshold
    }))

  if (!items.length) return sendJson(res, 200, { deals: [], threshold })

  res.setHeader('Cache-Control', 'no-store')
  const deals = await findDeals(items)
  sendJson(res, 200, { deals, threshold })
})
