import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken, verifyToken } from './_utils/auth.js'
import { withErrors } from './_utils/response.js'

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function redirectToFrontend(res, origin, path, params) {
  res.statusCode = 302
  res.setHeader('Location', `${origin}${path}?${new URLSearchParams(params).toString()}`)
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
  const linkToken = query.link_token
  const linkedUser = linkToken ? verifyToken(String(linkToken)) : null

  // A link_token was present but failed to verify (expired session, tampered
  // value, etc). Fail loudly here instead of silently falling through to the
  // "normal sign in" branch below, which could otherwise create a brand new
  // account or swap the user's session without any explanation.
  if (linkToken && !linkedUser) {
    console.error('Steam link failed: link_token present but did not verify')
    return redirectToFrontend(res, origin, '/account', { steamError: 'session_expired' })
  }

  if (!query['openid.claimed_id']) {
    return redirectToFrontend(res, origin, '/auth/steam-callback', { error: 'steam_failed' })
  }

  try {
    const valid = await verifyAssertion(query)
    if (!valid) return redirectToFrontend(res, origin, '/auth/steam-callback', { error: 'steam_failed' })

    const match = String(query['openid.claimed_id']).match(/(\d{17})$/)
    const steamId = match?.[1]
    if (!steamId) return redirectToFrontend(res, origin, '/auth/steam-callback', { error: 'steam_failed' })

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

    // --- linking Steam onto an already-logged-in account ---
    if (linkedUser) {
      const linkedUserId = Number(linkedUser.id)

      if (existing.rows[0] && Number(existing.rows[0].id) !== linkedUserId) {
        return redirectToFrontend(res, origin, '/account', { steamError: 'already_linked' })
      }

      const updateResult = await db.execute({
        sql: 'UPDATE users SET steam_id = ?, avatar = ? WHERE id = ?',
        args: [steamId, avatar, linkedUserId]
      })

      // If nothing was actually updated (stale/mismatched id, deleted user,
      // etc), don't lie to the user with a success redirect — the previous
      // version of this code did exactly that, which is why linking looked
      // like it worked but the account never actually got a steam_id.
      const rowsAffected = Number(updateResult?.rowsAffected ?? 0)
      if (rowsAffected < 1) {
        console.error('Steam link failed: UPDATE affected 0 rows', { linkedUserId, steamId })
        return redirectToFrontend(res, origin, '/account', { steamError: 'failed' })
      }

      console.log('Steam linked successfully', { linkedUserId, steamId })
      return redirectToFrontend(res, origin, '/account', { steamLinked: '1' })
    }

    // --- normal sign in / sign up via Steam ---
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
    redirectToFrontend(res, origin, '/auth/steam-callback', {
      token,
      id: String(user.id),
      username: user.username,
      email: user.email,
      avatar: avatar || ''
    })
  } catch (e) {
    console.error('Steam auth failed:', e)
    const path = linkedUser ? '/account' : '/auth/steam-callback'
    const params = linkedUser ? { steamError: 'failed' } : { error: 'steam_failed' }
    redirectToFrontend(res, origin, path, params)
  }
})
