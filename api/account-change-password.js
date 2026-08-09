import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

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
})
