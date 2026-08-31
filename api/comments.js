import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const MAX_LEN = 1000
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

async function list(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

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
}

async function add(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

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
}

async function remove(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

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
}

export default withErrors(async (req, res) => {
  if (req.query.action === 'list') {
    requireUser(req)
    return list(req, res)
  }
  const user = requireUser(req)
  switch (req.query.action) {
    case 'add': return add(req, res, user)
    case 'delete': return remove(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
