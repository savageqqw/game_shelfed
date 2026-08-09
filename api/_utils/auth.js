import jwt from 'jsonwebtoken'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set. See README for setup.')
  return secret
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, email: user.email }, getSecret(), {
    expiresIn: '30d'
  })
}

export function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  try {
    const payload = jwt.verify(header.slice(7), getSecret())
    return { id: payload.sub, username: payload.username, email: payload.email }
  } catch {
    const err = new Error('Invalid or expired session')
    err.statusCode = 401
    throw err
  }
}
