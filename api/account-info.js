import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT username, email, created_at FROM users WHERE id = ?',
    args: [user.id]
  })
  const row = result.rows[0]
  if (!row) return sendJson(res, 404, { error: 'User not found' })

  sendJson(res, 200, { username: row.username, email: row.email, createdAt: row.created_at })
})
