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
    sql: "SELECT game_id, title, cover FROM library_items WHERE user_id = ? AND status = 'planned'",
    args: [user.id]
  })
  const items = planned.rows

  if (!items.length) return sendJson(res, 200, { deals: [], threshold })

  res.setHeader('Cache-Control', 'no-store')
  const deals = await findDeals(items, threshold)
  sendJson(res, 200, { deals, threshold })
})
