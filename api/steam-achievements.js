import { requireUser } from './_utils/auth.js'
import { getClient, ensureSchema } from './_utils/db.js'
import { sendJson, withErrors } from './_utils/response.js'

const CONCURRENCY = 8

async function fetchOne(appid, steamId, apiKey) {
  const url = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('steamid', steamId)
  url.searchParams.set('appid', String(appid))

  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const data = await r.json()
    const stats = data?.playerstats
    // success is false when the game has no achievements, isn't owned, or
    // the profile's "game details" privacy blocks it -- just skip quietly.
    if (!stats?.success || !Array.isArray(stats.achievements) || !stats.achievements.length) return null

    const total = stats.achievements.length
    const unlocked = stats.achievements.filter((a) => a.achieved === 1).length
    return { appid, unlocked, total, percent: Math.round((unlocked / total) * 100) }
  } catch {
    return null
  }
}

async function fetchInBatches(appids, steamId, apiKey) {
  const results = {}
  for (let i = 0; i < appids.length; i += CONCURRENCY) {
    const slice = appids.slice(i, i + CONCURRENCY)
    const settled = await Promise.all(slice.map((id) => fetchOne(id, steamId, apiKey)))
    for (const r of settled) {
      if (r) results[r.appid] = { unlocked: r.unlocked, total: r.total, percent: r.percent }
    }
  }
  return results
}

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) {
    const err = new Error('STEAM_API_KEY is not configured. See README for setup.')
    err.statusCode = 500
    throw err
  }

  const body = req.body || {}
  const appids = Array.isArray(body.appids)
    ? [...new Set(body.appids.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n)))].slice(0, 80)
    : []

  if (!appids.length) return sendJson(res, 200, { results: {} })

  await ensureSchema()
  const db = getClient()
  const own = await db.execute({ sql: 'SELECT steam_id FROM users WHERE id = ?', args: [user.id] })
  const steamId = own.rows[0]?.steam_id || null
  if (!steamId) return sendJson(res, 404, { error: 'not-found' })

  res.setHeader('Cache-Control', 'no-store')

  const results = await fetchInBatches(appids, steamId, apiKey)
  sendJson(res, 200, { results })
})
