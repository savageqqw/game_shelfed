import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// `code` lets the client show the message in the visitor's language
function fail(res, status, code, error) {
  return sendJson(res, status, { error, code })
}

async function login(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { email, password } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return fail(res, 400, 'missing_fields', 'Email and password are required')
  }

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT id, username, email, password_hash FROM users WHERE email = ?',
    args: [email.toLowerCase().trim()]
  })
  const row = result.rows[0]
  if (!row) return fail(res, 401, 'bad_credentials', 'Invalid email or password')

  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid) return fail(res, 401, 'bad_credentials', 'Invalid email or password')

  const user = { id: Number(row.id), username: row.username, email: row.email }
  const token = signToken(user)

  sendJson(res, 200, { token, user })
}

async function register(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const body = req.body || {}
  const username = typeof body.username === 'string' ? body.username.trim().replace(/\s+/g, ' ') : ''
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !email || !password) {
    return fail(res, 400, 'missing_fields', 'Username, email and password are required')
  }
  if (username.length < 2 || username.length > 32 || /[\u0000-\u001f<>]/.test(username)) {
    return fail(res, 400, 'bad_username', 'Username must be 2 to 32 characters')
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return fail(res, 400, 'bad_email', 'Enter a valid email address')
  }
  if (password.length < 6) {
    return fail(res, 400, 'short_password', 'Password must be at least 6 characters')
  }
  if (password.length > 200) {
    return fail(res, 400, 'long_password', 'Password is too long')
  }

  await ensureSchema()
  const db = getClient()

  const [byEmail, byName] = await Promise.all([
    db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] }),
    db.execute({ sql: 'SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1', args: [username] })
  ])
  if (byEmail.rows.length) {
    return fail(res, 409, 'email_taken', 'An account with this email already exists')
  }
  if (byName.rows.length) {
    return fail(res, 409, 'username_taken', 'This username is already taken')
  }

  const hash = await bcrypt.hash(password, 10)
  const result = await db.execute({
    sql: 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    args: [username, email, hash]
  })

  const user = { id: Number(result.lastInsertRowid), username, email }
  const token = signToken(user)

  sendJson(res, 201, { token, user })
}

export default withErrors(async (req, res) => {
  switch (req.query.action) {
    case 'login': return login(req, res)
    case 'register': return register(req, res)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
