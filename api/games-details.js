import { sendJson, withErrors } from './_utils/response.js'

// Shares the same app-token cache pattern as games-search.js (separate
// module instance, so it keeps its own short-lived cache per warm lambda).
let cachedToken = null
let cachedExpiry = 0

async function getAppToken() {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken

  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    const err = new Error('IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are not configured.')
    err.statusCode = 500
    throw err
  }

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')

  const res = await fetch(tokenUrl, { method: 'POST' })
  if (!res.ok) {
    const err = new Error('Failed to authenticate with the game catalog provider')
    err.statusCode = 502
    throw err
  }
  const data = await res.json()
  cachedToken = data.access_token
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const clientId = process.env.IGDB_CLIENT_ID
  const token = await getAppToken()

  const idsParam = (req.query?.ids || '').trim()
  const ids = idsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, 50)

  if (!ids.length) return sendJson(res, 200, { results: [] })

  const body = `where id = (${ids.join(',')}); fields id,rating,first_release_date,genres.name; limit ${ids.length};`

  const igdbRes = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body
  })
  if (!igdbRes.ok) {
    const err = new Error('Failed to reach the game catalog provider')
    err.statusCode = igdbRes.status
    throw err
  }
  const games = await igdbRes.json()

  const results = (games || []).map((g) => ({
    id: g.id,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results })
})
