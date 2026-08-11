import { requireUser } from './_utils/auth.js'
import { getClient, ensureSchema } from './_utils/db.js'
import { sendJson, withErrors } from './_utils/response.js'

function extractSteamInput(raw) {
  const value = raw.trim()
  // Accept a full profile URL, a bare vanity name, or a 17-digit SteamID64.
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

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

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
    // No profile typed in — use the Steam account already linked to this login.
    await ensureSchema()
    const db = getClient()
    const own = await db.execute({ sql: 'SELECT steam_id FROM users WHERE id = ?', args: [user.id] })
    steamId = own.rows[0]?.steam_id || null
  }

  if (!steamId) return sendJson(res, 404, { error: 'not-found' })

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
    // Either an invalid SteamID, or "Game details" privacy is not Public.
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
})
