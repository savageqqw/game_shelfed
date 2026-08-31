import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

async function info(req, res, user) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT username, email, avatar, steam_id, created_at, deal_threshold_percent FROM users WHERE id = ?',
    args: [user.id]
  })
  const row = result.rows[0]
  if (!row) return sendJson(res, 404, { error: 'User not found' })

  res.setHeader('Cache-Control', 'no-store')
  sendJson(res, 200, {
    username: row.username,
    email: row.email,
    avatar: row.avatar || null,
    steamLinked: !!row.steam_id,
    createdAt: row.created_at,
    dealThresholdPercent: row.deal_threshold_percent ?? 20
  })
}

async function dealThreshold(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const percent = parseInt(req.body?.percent, 10)
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
    return sendJson(res, 400, { error: 'percent must be between 1 and 90' })
  }

  await ensureSchema()
  const db = getClient()
  await db.execute({
    sql: 'UPDATE users SET deal_threshold_percent = ? WHERE id = ?',
    args: [percent, user.id]
  })

  sendJson(res, 200, { dealThresholdPercent: percent })
}

async function changePassword(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) {
    return sendJson(res, 400, { error: 'Current and new password are required' })
  }
  if (newPassword.length < 6) {
    return sendJson(res, 400, { error: 'New password must be at least 6 characters' })
  }

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT password_hash FROM users WHERE id = ?',
    args: [user.id]
  })
  const row = result.rows[0]
  if (!row) return sendJson(res, 404, { error: 'User not found' })

  const valid = await bcrypt.compare(currentPassword, row.password_hash)
  if (!valid) return sendJson(res, 401, { error: 'Current password is incorrect' })

  const hash = await bcrypt.hash(newPassword, 10)
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [hash, user.id]
  })

  sendJson(res, 200, { ok: true })
}

export default withErrors(async (req, res) => {
  const user = requireUser(req)
  switch (req.query.action) {
    case 'info': return info(req, res, user)
    case 'deal-threshold': return dealThreshold(req, res, user)
    case 'change-password': return changePassword(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
