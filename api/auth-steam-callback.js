import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken, verifyToken } from './_utils/auth.js'
import { withErrors } from './_utils/response.js'

// STEAM-LINK-REWRITE-v2
// Full rewrite: every branch logs what it's doing, and a successful "link"
// is only ever reported to the user after re-reading the row back from the
// database to confirm steam_id actually stuck.

// Runs once per cold start -- surfaces missing env vars immediately in
// Runtime Logs instead of only failing deep inside a request.
;(function checkEnvOnColdStart() {
  const missing = ['JWT_SECRET', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'STEAM_API_KEY']
    .filter((key) => !process.env[key])
  if (missing.length) {
    console.error('[steam-callback] COLD START WARNING -- missing env vars:', missing.join(', '))
  } else {
    console.log('[steam-callback] cold start OK, all required env vars present')
  }
})()

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function redirectTo(res, origin, path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  res.statusCode = 302
  res.setHeader('Location', `${origin}${path}${qs ? `?${qs}` : ''}`)
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
  if (!apiKey) return null
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('steamids', steamId)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data?.response?.players?.[0] || null
  } catch (e) {
    console.error('[steam-callback] fetchSteamProfile failed', e)
    return null
  }
}

export default withErrors(async (req, res) => {
  const origin = siteOrigin(req)

  if (req.method !== 'GET') {
    res.statusCode = 405
    return res.end('Method not allowed')
  }

  const query = req.query || {}
  const rawLinkToken = query.link_token ? String(query.link_token) : null
  const linkedUser = rawLinkToken ? verifyToken(rawLinkToken) : null

  console.log('[steam-callback] invoked', {
    hasLinkToken: !!rawLinkToken,
    linkTokenVerified: !!linkedUser,
    hasClaimedId: !!query['openid.claimed_id']
  })

  // auth-steam-start.js already checks the link_token before sending the
  // person to Steam, so getting here with a token that fails to verify means
  // it expired mid-flow. Fail loudly instead of silently falling into the
  // "normal sign in" branch below, which would create/swap accounts.
  if (rawLinkToken && !linkedUser) {
    console.error('[steam-callback] link_token present but invalid/expired')
    return redirectTo(res, origin, '/account', { steamError: 'session_expired' })
  }

  if (!query['openid.claimed_id']) {
    console.error('[steam-callback] missing openid.claimed_id -- user likely cancelled on Steam')
    return linkedUser
      ? redirectTo(res, origin, '/account', { steamError: 'failed' })
      : redirectTo(res, origin, '/auth/steam-callback', { error: 'steam_failed' })
  }

  try {
    const valid = await verifyAssertion(query)
    console.log('[steam-callback] openid assertion valid?', valid)
    if (!valid) {
      return linkedUser
        ? redirectTo(res, origin, '/account', { steamError: 'failed' })
        : redirectTo(res, origin, '/auth/steam-callback', { error: 'steam_failed' })
    }

    const match = String(query['openid.claimed_id']).match(/(\d{17})$/)
    const steamId = match?.[1]
    console.log('[steam-callback] resolved steamId', steamId)
    if (!steamId) {
      return linkedUser
        ? redirectTo(res, origin, '/account', { steamError: 'failed' })
        : redirectTo(res, origin, '/auth/steam-callback', { error: 'steam_failed' })
    }

    const apiKey = process.env.STEAM_API_KEY
    if (!apiKey) console.error('[steam-callback] STEAM_API_KEY is not set -- profile name/avatar will be skipped')

    const profile = await fetchSteamProfile(steamId, apiKey)
    const displayName = profile?.personaname?.trim() || `Steamer${steamId.slice(-6)}`
    const avatar = profile?.avatarfull || null

    await ensureSchema()
    const db = getClient()

    const existing = await db.execute({
      sql: 'SELECT id, username, email, steam_id FROM users WHERE steam_id = ?',
      args: [steamId]
    })
    console.log('[steam-callback] existing user with this steamId?', existing.rows[0]?.id ?? null)

    // --- linking Steam onto an already-logged-in account ---
    if (linkedUser) {
      const linkedUserId = Number(linkedUser.id)

      if (existing.rows[0] && Number(existing.rows[0].id) !== linkedUserId) {
        console.error('[steam-callback] this Steam account is already linked to a different user', {
          steamId, existingUserId: existing.rows[0].id, linkedUserId
        })
        return redirectTo(res, origin, '/account', { steamError: 'already_linked' })
      }

      const updateResult = await db.execute({
        sql: 'UPDATE users SET steam_id = ?, avatar = ? WHERE id = ?',
        args: [steamId, avatar, linkedUserId]
      })
      console.log('[steam-callback] link UPDATE result', { rowsAffected: updateResult?.rowsAffected })

      // Belt and suspenders: re-read the row instead of trusting rowsAffected
      // alone, so a false "success" can never reach the user again.
      const verify = await db.execute({
        sql: 'SELECT steam_id FROM users WHERE id = ?',
        args: [linkedUserId]
      })
      const persisted = verify.rows[0]?.steam_id === steamId
      console.log('[steam-callback] post-update verification', {
        persisted,
        storedValue: verify.rows[0]?.steam_id
      })

      if (!persisted) {
        console.error('[steam-callback] steam_id did NOT persist after UPDATE', { linkedUserId, steamId })
        return redirectTo(res, origin, '/account', { steamError: 'failed' })
      }

      console.log('[steam-callback] Steam linked successfully', { linkedUserId, steamId })
      return redirectTo(res, origin, '/account', { steamLinked: '1' })
    }

    // --- normal sign in / sign up via Steam ---
    let user
    if (existing.rows[0]) {
      await db.execute({
        sql: 'UPDATE users SET username = ?, avatar = ? WHERE id = ?',
        args: [displayName, avatar, existing.rows[0].id]
      })
      user = { id: Number(existing.rows[0].id), username: displayName, email: existing.rows[0].email }
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
    console.log('[steam-callback] signed in via Steam as user', user.id)
    redirectTo(res, origin, '/auth/steam-callback', {
      token,
      id: String(user.id),
      username: user.username,
      email: user.email,
      avatar: avatar || ''
    })
  } catch (e) {
    console.error('[steam-callback] unhandled error', e)
    const path = linkedUser ? '/account' : '/auth/steam-callback'
    const params = linkedUser ? { steamError: 'failed' } : { error: 'steam_failed' }
    redirectTo(res, origin, path, params)
  }
})
