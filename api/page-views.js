import { getClient, ensureSchema } from './_utils/db.js'
import { optionalUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function track(req, res) {
  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: `INSERT INTO page_views (day, count) VALUES (?, 1)
          ON CONFLICT(day) DO UPDATE SET count = count + 1`,
    args: [today()]
  })

  const user = optionalUser(req)
  const visitorId = req.body?.visitorId ? String(req.body.visitorId).slice(0, 64) : null

  let isNew = false
  if (user) {
    const seen = await db.execute({ sql: 'SELECT 1 FROM visits WHERE user_id = ? LIMIT 1', args: [user.id] })
    isNew = seen.rows.length === 0
  } else if (visitorId) {
    const seen = await db.execute({ sql: 'SELECT 1 FROM visits WHERE visitor_id = ? LIMIT 1', args: [visitorId] })
    isNew = seen.rows.length === 0
  }

  await db.execute({
    sql: 'INSERT INTO visits (user_id, username, visitor_id, is_new_visitor) VALUES (?, ?, ?, ?)',
    args: [user?.id ?? null, user?.username ?? null, visitorId, isNew ? 1 : 0]
  })

  sendJson(res, 200, { ok: true })
}

async function weekly(req, res) {
  await ensureSchema()
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(count), 0) AS total FROM page_views
          WHERE day >= date('now', '-6 days')`,
    args: []
  })
  sendJson(res, 200, { views: Number(result.rows[0]?.total || 0) })
}

async function recent(req, res) {
  const user = optionalUser(req)
  if (!user || (user.username || '').toLowerCase() !== ADMIN_USERNAME) {
    return sendJson(res, 403, { error: 'Forbidden' })
  }

  await ensureSchema()
  const db = getClient()
  const result = await db.execute({
    sql: 'SELECT id, created_at, user_id, username, visitor_id, is_new_visitor FROM visits ORDER BY id DESC LIMIT 60',
    args: []
  })

  const visits = result.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    userId: r.user_id,
    username: r.username,
    isSelf: r.user_id === user.id,
    isNewVisitor: !!r.is_new_visitor,
    isGuest: !r.user_id
  }))

  sendJson(res, 200, { visits })
}

export default withErrors(async (req, res) => {
  if (req.method === 'POST') return track(req, res)
  if (req.method === 'GET') {
    if (req.query?.scope === 'recent') return recent(req, res)
    return weekly(req, res)
  }
  sendJson(res, 405, { error: 'Method not allowed' })
})
