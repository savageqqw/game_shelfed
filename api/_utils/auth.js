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

export function verifyToken(rawToken) {
  try {
    const payload = jwt.verify(rawToken, getSecret())
    return { id: payload.sub, username: payload.username, email: payload.email }
  } catch {
    return null
  }
}

export function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  const user = verifyToken(header.slice(7))
  if (!user) {
    const err = new Error('Invalid or expired session')
    err.statusCode = 401
    throw err
  }
  return user
}

// Like requireUser, but returns null for guests instead of throwing --
// for endpoints that work for anyone but behave differently when signed in.
export function optionalUser(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return verifyToken(header.slice(7))
}
