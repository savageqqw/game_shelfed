import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser, signToken, verifyToken } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { igdbBestMatch } from './_utils/igdb.js'
import { upsertLibraryItem, VALID_STATUSES } from './_utils/library.js'

const MAX_PER_REQUEST = 60

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

// --- OAuth: kick off "Sign in with Steam" / "Link Steam account" ---
async function start(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    return res.end('Method not allowed')
  }

  const origin = siteOrigin(req)
  const rawLinkToken = req.query?.link_token ? String(req.query.link_token) : null

  if (rawLinkToken) {
    const linkedUser = verifyToken(rawLinkToken)
    if (!linkedUser) {
      res.statusCode = 302
      res.setHeader('Location', `${origin}/account?steamError=session_expired`)
      return res.end()
    }
  }

  let returnTo = `${origin}/api/steam?action=callback`
  if (rawLinkToken) returnTo += `&link_token=${encodeURIComponent(rawLinkToken)}`

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })

  res.statusCode = 302
  res.setHeader('Location', `https://steamcommunity.com/openid/login?${params.toString()}`)
  res.end()
}

// --- OAuth: Steam bounces back here after login ---
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
    console.error('[steam callback] fetchSteamProfile failed', e)
    return null
  }
}

async function callback(req, res) {
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

  if (rawLinkToken && !linkedUser) return fail('link_token_invalid')
  if (!query['openid.claimed_id']) return fail('no_claimed_id')

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
      const verify = await db.execute({ sql: 'SELECT id, steam_id FROM users WHERE id = ?', args: [linkedUserId] })
      const foundRow = verify.rows[0]
      const persisted = foundRow?.steam_id === steamId

      if (!persisted) {
        return fail('update_did_not_persist', {
          debug: `uid=${linkedUserId},rows=${rowsAffected},found=${foundRow ? 'yes' : 'no'},storedSteamId=${foundRow?.steam_id || 'null'}`
        })
      }

      return redirectTo(res, origin, '/account', { steamLinked: '1' })
    }

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
    console.error('[steam callback] unhandled error', e)
    return fail('unhandled', { debug: String(e.message || e).slice(0, 120) })
  }
}

// --- fetch a Steam library (own linked account or any public profile) ---
function extractSteamInput(raw) {
  const value = raw.trim()
  const urlMatch = value.match(/steamcommunity\.com\/(id|profiles)\/([^/?#]+)/i)
  if (urlMatch) return { kind: urlMatch[1] === 'profiles' ? 'id64' : 'vanity', value: urlMatch[2] }
  if (/^\d{17}$/.test(value)) return { kind: 'id64', value }
  return { kind: 'vanity', value }
}

async function resolveVanity(vanity, apiKey) {
  const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('vanityurl', vanity)
  const res = await fetch(url)
  if (!res.ok) {
    const err = new Error('Failed to reach Steam')
    err.statusCode = 502
    throw err
  }
  const data = await res.json()
  if (data?.response?.success !== 1) return null
  return data.response.steamid
}

async function library(req, res, user) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) {
    const err = new Error('STEAM_API_KEY is not configured. See README for setup.')
    err.statusCode = 500
    throw err
  }

  const raw = (req.query?.steamid || '').trim()
  let steamId

  if (raw) {
    const parsed = extractSteamInput(raw)
    steamId = parsed.kind === 'id64' ? parsed.value : await resolveVanity(parsed.value, apiKey)
  } else {
    await ensureSchema()
    const db = getClient()
    const own = await db.execute({ sql: 'SELECT steam_id FROM users WHERE id = ?', args: [user.id] })
    steamId = own.rows[0]?.steam_id || null
  }

  if (!steamId) return sendJson(res, 404, { error: 'not-found' })

  res.setHeader('Cache-Control', 'no-store')

  const gamesUrl = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/')
  gamesUrl.searchParams.set('key', apiKey)
  gamesUrl.searchParams.set('steamid', steamId)
  gamesUrl.searchParams.set('include_appinfo', 'true')
  gamesUrl.searchParams.set('include_played_free_games', 'true')
  gamesUrl.searchParams.set('format', 'json')

  const gamesRes = await fetch(gamesUrl)
  if (!gamesRes.ok) {
    const err = new Error('Failed to reach Steam')
    err.statusCode = 502
    throw err
  }
  const gamesData = await gamesRes.json()
  const rawGames = gamesData?.response?.games

  if (!Array.isArray(rawGames)) {
    return sendJson(res, 200, { games: [], privacyBlocked: true })
  }

  const games = rawGames
    .map((g) => ({
      appid: g.appid,
      title: g.name,
      playtimeMinutes: g.playtime_forever || 0,
      cover: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
    }))
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)

  sendJson(res, 200, { games, count: games.length, privacyBlocked: false })
}

// --- bulk-import selected Steam games into the library ---
async function importGames(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { status, games } = req.body || {}
  if (!VALID_STATUSES.includes(status)) return sendJson(res, 400, { error: 'Invalid status' })
  if (!Array.isArray(games) || !games.length) return sendJson(res, 400, { error: 'No games selected' })

  await ensureSchema()

  const selection = games.slice(0, MAX_PER_REQUEST)
  const items = []
  let matched = 0

  for (const g of selection) {
    const appid = g.appid
    const steamTitle = String(g.title || '').trim()
    if (!appid || !steamTitle) continue

    let match = null
    try {
      match = await igdbBestMatch(steamTitle)
    } catch {
      match = null
    }

    const gameId = match ? String(match.id) : `steam:${appid}`
    const title = match ? match.title : steamTitle
    const cover = match?.cover || `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`
    if (match) matched += 1

    const item = await upsertLibraryItem(user.id, {
      gameId,
      title,
      cover,
      status,
      genres: match?.genres || null,
      released: match?.released || null,
      catalogRating: match?.rating ?? null,
      playtimeMinutes: typeof g.playtimeMinutes === 'number' ? g.playtimeMinutes : null
    })
    items.push(item)
  }

  sendJson(res, 200, { items, added: items.length, matched })
}

export default withErrors(async (req, res) => {
  const action = req.query.action
  // start/callback are OAuth redirect legs -- no bearer token to check.
  if (action === 'start') return start(req, res)
  if (action === 'callback') return callback(req, res)

  const user = requireUser(req)
  switch (action) {
    case 'library': return library(req, res, user)
    case 'import': return importGames(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
