import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: 'DELETE FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })

  sendJson(res, 200, { ok: true })
})
