import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  requireUser(req)

  await ensureSchema()
  const db = getClient()

  const result = await db.execute(`
    SELECT c.id, c.body, c.created_at, u.username, u.avatar, u.id AS user_id
    FROM comments c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
    LIMIT 200
  `)

  const comments = result.rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    username: r.username,
    avatar: r.avatar || null,
    userId: r.user_id
  }))

  sendJson(res, 200, { comments })
})
