import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { username, email, password } = req.body || {}
  if (!username || !email || !password) {
    return sendJson(res, 400, { error: 'Username, email and password are required' })
  }
  if (password.length < 6) {
    return sendJson(res, 400, { error: 'Password must be at least 6 characters' })
  }

  await ensureSchema()
  const db = getClient()

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.toLowerCase().trim()]
  })
  if (existing.rows.length) {
    return sendJson(res, 409, { error: 'An account with this email already exists' })
  }

  const hash = await bcrypt.hash(password, 10)
  const result = await db.execute({
    sql: 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    args: [username.trim(), email.toLowerCase().trim(), hash]
  })

  const user = { id: Number(result.lastInsertRowid), username: username.trim(), email: email.toLowerCase().trim() }
  const token = signToken(user)

  sendJson(res, 201, { token, user })
})
