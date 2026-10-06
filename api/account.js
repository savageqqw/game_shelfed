import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { isAdmin } from './_utils/admin.js'

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
    dealThresholdPercent: row.deal_threshold_percent ?? 20,
    isAdmin: await isAdmin(db, user)
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
  // 400, not 401: a 401 makes the client treat the session as expired
  if (!valid) return sendJson(res, 400, { error: 'Current password is incorrect', code: 'bad_current_password' })

  const hash = await bcrypt.hash(newPassword, 10)
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [hash, user.id]
  })

  sendJson(res, 200, { ok: true })
}

// Erases the account and everything tied to it. The person confirms by
// typing their username, which works for Steam accounts too (they have no
// password they know). Visit rows stay for the totals but lose the name.
async function deleteAccount(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({ sql: 'SELECT username FROM users WHERE id = ?', args: [user.id] })
  const row = result.rows[0]
  if (!row) return sendJson(res, 404, { error: 'User not found' })

  const typed = typeof req.body?.confirm === 'string' ? req.body.confirm.trim() : ''
  if (typed.toLowerCase() !== String(row.username).toLowerCase()) {
    return sendJson(res, 400, { error: 'Username does not match', code: 'confirm_mismatch' })
  }
  // the site owner's account holds the admin role, so it can't go by accident
  if (await isAdmin(db, user)) return sendJson(res, 403, { error: 'Admin account', code: 'admin_locked' })

  await db.batch([
    { sql: 'DELETE FROM library_items WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM comments WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM push_subscriptions WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM notified_deals WHERE user_id = ?', args: [user.id] },
    { sql: 'UPDATE visits SET user_id = NULL, username = NULL WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM users WHERE id = ?', args: [user.id] }
  ], 'write')

  sendJson(res, 200, { ok: true })
}

export default withErrors(async (req, res) => {
  const user = requireUser(req)
  switch (req.query.action) {
    case 'info': return info(req, res, user)
    case 'deal-threshold': return dealThreshold(req, res, user)
    case 'change-password': return changePassword(req, res, user)
    case 'delete': return deleteAccount(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
