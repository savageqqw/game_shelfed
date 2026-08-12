import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { signToken, verifyToken } from './_utils/auth.js'
import { withErrors } from './_utils/response.js'

// STEAM-LINK-REWRITE-v3
// Every failure branch now carries its OWN distinct steamError code, and the
// linking success/failure redirect carries a `debug` param with the raw
// facts (linkedUserId, steamId, rowsAffected, persisted). This makes the
// failure visible directly on the /account page -- no more digging through
// Vercel's dashboard to find out what happened.

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
  const isLinkFlow = !!rawLinkToken

  const fail = (code, extra = {}) => {
    const params = { steamError: code, ...extra }
    return isLinkFlow
      ? redirectTo(res, origin, '/account', params)
      : redirectTo(res, origin, '/auth/steam-callback', { error: code })
  }

  if (rawLinkToken && !linkedUser) {
    return fail('link_token_invalid')
  }

  if (!query['openid.claimed_id']) {
    return fail('no_claimed_id')
  }

  try {
    const valid = await verifyAssertion(query)
    if (!valid) return fail('openid_not_valid')

    const match = String(query['openid.claimed_id']).match(/(\d{17})$/)
    const steamId = match?.[1]
    if (!steamId) return fail('no_steamid_in_claimed_id')

    const apiKey = process.env.STEAM_API_KEY
    const profile = await fetchSteamProfile(steamId, apiKey)
    const displayName = profile?.personaname?.trim() || `Steamer${steamId.slice(-6)}`
    const avatar = profile?.avatarfull || null

    await ensureSchema()
    const db = getClient()

    const existing = await db.execute({
      sql: 'SELECT id, username, email, steam_id FROM users WHERE steam_id = ?',
      args: [steamId]
    })

    // --- linking Steam onto an already-logged-in account ---
    if (linkedUser) {
      const linkedUserId = Number(linkedUser.id)

      if (existing.rows[0] && Number(existing.rows[0].id) !== linkedUserId) {
        const orphanId = existing.rows[0].id
        const orphanEmail = existing.rows[0].email || ''
        const looksAutoCreated = orphanEmail === `steam-${steamId}@steamusers.local`

        let orphanIsEmpty = false
        if (looksAutoCreated) {
          const orphanLib = await db.execute({
            sql: 'SELECT COUNT(*) as cnt FROM library_items WHERE user_id = ?',
            args: [orphanId]
          })
          orphanIsEmpty = Number(orphanLib.rows[0]?.cnt || 0) === 0
        }

        if (looksAutoCreated && orphanIsEmpty) {
          // This is a throwaway account that got created automatically the
          // first time this Steam profile was used to "Sign in with Steam"
          // (before the person ever linked it to their real account here).
          // It has no library data, so it's safe to free up the steam_id.
          await db.execute({ sql: 'UPDATE users SET steam_id = NULL WHERE id = ?', args: [orphanId] })
        } else {
          return fail('already_linked', { debug: `existing=${orphanId},me=${linkedUserId}` })
        }
      }

      let updateResult
      try {
        updateResult = await db.execute({
          sql: 'UPDATE users SET steam_id = ?, avatar = ? WHERE id = ?',
          args: [steamId, avatar, linkedUserId]
        })
      } catch (dbErr) {
        return fail('update_threw', { debug: String(dbErr.message || dbErr).slice(0, 120) })
      }

      const rowsAffected = Number(updateResult?.rowsAffected ?? -1)

      const verify = await db.execute({
        sql: 'SELECT id, steam_id FROM users WHERE id = ?',
        args: [linkedUserId]
      })
      const foundRow = verify.rows[0]
      const persisted = foundRow?.steam_id === steamId

      if (!persisted) {
        return fail('update_did_not_persist', {
          debug: `uid=${linkedUserId},rows=${rowsAffected},found=${foundRow ? 'yes' : 'no'},storedSteamId=${foundRow?.steam_id || 'null'}`
        })
      }

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
    redirectTo(res, origin, '/auth/steam-callback', {
      token,
      id: String(user.id),
      username: user.username,
      email: user.email,
      avatar: avatar || ''
    })
  } catch (e) {
    console.error('[steam-callback] unhandled error', e)
    return fail('unhandled', { debug: String(e.message || e).slice(0, 120) })
  }
})
