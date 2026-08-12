import { ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { igdbBestMatch } from './_utils/igdb.js'
import { upsertLibraryItem, VALID_STATUSES } from './_utils/library.js'

const MAX_PER_REQUEST = 60

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { status, games } = req.body || {}
  if (!VALID_STATUSES.includes(status)) return sendJson(res, 400, { error: 'Invalid status' })
  if (!Array.isArray(games) || !games.length) return sendJson(res, 400, { error: 'No games selected' })

  await ensureSchema()

  const selection = games.slice(0, MAX_PER_REQUEST)
  const items = []
  let matched = 0

  // Sequential on purpose — keeps us well under IGDB's rate limit for what
  // is an explicit, user-triggered bulk action rather than a hot path.
  for (const g of selection) {
    const appid = g.appid
    const steamTitle = String(g.title || '').trim()
    if (!appid || !steamTitle) continue

    let match = null
    try {
      match = await igdbBestMatch(steamTitle)
    } catch {
      match = null // fall back to Steam's own data below
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
})
