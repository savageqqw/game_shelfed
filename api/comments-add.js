import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const MAX_LEN = 1000

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const body = String(req.body?.body || '').trim()
  if (!body) return sendJson(res, 400, { error: 'Comment cannot be empty' })
  if (body.length > MAX_LEN) return sendJson(res, 400, { error: `Comment is too long (max ${MAX_LEN} characters)` })

  await ensureSchema()
  const db = getClient()

  const insert = await db.execute({
    sql: 'INSERT INTO comments (user_id, body) VALUES (?, ?)',
    args: [user.id, body]
  })

  const result = await db.execute({
    sql: `
      SELECT c.id, c.body, c.created_at, u.username, u.avatar, u.id AS user_id
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `,
    args: [insert.lastInsertRowid]
  })
  const r = result.rows[0]

  sendJson(res, 200, {
    comment: {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      username: r.username,
      avatar: r.avatar || null,
      userId: r.user_id
    }
  })
})
