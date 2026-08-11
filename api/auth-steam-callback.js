import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken } from './_utils/auth.js'
import { withErrors } from './_utils/response.js'

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function redirectToFrontend(res, origin, params) {
  res.statusCode = 302
  res.setHeader('Location', `${origin}/auth/steam-callback?${new URLSearchParams(params).toString()}`)
  res.end()
}

async function verifyAssertion(query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('openid.')) params.set(key, value)
  }
  params.set('openid.mode', 'check_authentication')

  const res = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })
  const text = await res.text()
  return /is_valid\s*:\s*true/.test(text)
}

async function fetchSteamProfile(steamId, apiKey) {
  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('steamids', steamId)
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data?.response?.players?.[0] || null
}

export default withErrors(async (req, res) => {
  const origin = siteOrigin(req)

  if (req.method !== 'GET') {
    res.statusCode = 405
    return res.end('Method not allowed')
  }

  const query = req.query || {}
  if (!query['openid.claimed_id']) {
    return redirectToFrontend(res, origin, { error: 'steam_failed' })
  }

  try {
    const valid = await verifyAssertion(query)
    if (!valid) return redirectToFrontend(res, origin, { error: 'steam_failed' })

    const match = String(query['openid.claimed_id']).match(/(\d{17})$/)
    const steamId = match?.[1]
    if (!steamId) return redirectToFrontend(res, origin, { error: 'steam_failed' })

    const apiKey = process.env.STEAM_API_KEY
    const profile = apiKey ? await fetchSteamProfile(steamId, apiKey) : null
    const displayName = profile?.personaname?.trim() || `Steamer${steamId.slice(-6)}`
    const avatar = profile?.avatarfull || null

    await ensureSchema()
    const db = getClient()

    const existing = await db.execute({
      sql: 'SELECT id, username, email FROM users WHERE steam_id = ?',
      args: [steamId]
    })

    let user
    if (existing.rows[0]) {
      await db.execute({
        sql: 'UPDATE users SET username = ?, avatar = ? WHERE id = ?',
        args: [displayName, avatar, existing.rows[0].id]
      })
      user = { id: existing.rows[0].id, username: displayName, email: existing.rows[0].email }
    } else {
      const placeholderHash = await bcrypt.hash(randomUUID(), 10)
      const email = `steam-${steamId}@steamusers.local`
      const insertRes = await db.execute({
        sql: 'INSERT INTO users (username, email, password_hash, steam_id, avatar) VALUES (?, ?, ?, ?, ?)',
        args: [displayName, email, placeholderHash, steamId, avatar]
      })
      user = { id: Number(insertRes.lastInsertRowid), username: displayName, email }
    }

    const token = signToken(user)
    redirectToFrontend(res, origin, {
      token,
      id: String(user.id),
      username: user.username,
      email: user.email,
      avatar: avatar || ''
    })
  } catch (e) {
    console.error('Steam auth failed:', e)
    redirectToFrontend(res, origin, { error: 'steam_failed' })
  }
})
