import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { email, password } = req.body || {}
  if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required' })

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT id, username, email, password_hash FROM users WHERE email = ?',
    args: [email.toLowerCase().trim()]
  })
  const row = result.rows[0]
  if (!row) return sendJson(res, 401, { error: 'Invalid email or password' })

  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid) return sendJson(res, 401, { error: 'Invalid email or password' })

  const user = { id: Number(row.id), username: row.username, email: row.email }
  const token = signToken(user)

  sendJson(res, 200, { token, user })
})
