import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const id = parseInt(req.body?.id, 10)
  if (!Number.isFinite(id)) return sendJson(res, 400, { error: 'id is required' })

  await ensureSchema()
  const db = getClient()

  const isAdmin = (user.username || '').toLowerCase() === ADMIN_USERNAME
  const result = await db.execute({
    sql: isAdmin
      ? 'DELETE FROM comments WHERE id = ?'
      : 'DELETE FROM comments WHERE id = ? AND user_id = ?',
    args: isAdmin ? [id] : [id, user.id]
  })

  if (!result.rowsAffected) return sendJson(res, 404, { error: 'Comment not found' })
  sendJson(res, 200, { deleted: true })
})
