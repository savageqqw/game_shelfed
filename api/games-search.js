import { sendJson, withErrors } from './_utils/response.js'

const PAGE_SIZE = 24

// Cached across warm invocations of this function instance.
let cachedToken = null
let cachedExpiry = 0

async function getAppToken() {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken

  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    const err = new Error(
      'IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are not configured. Create a free app at dev.twitch.tv/console/apps and set both in Vercel env vars.'
    )
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

function escapeQuery(q) {
  return q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function igdbFetch(path, body, clientId, token) {
  const res = await fetch(`https://api.igdb.com/v4/${path}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body
  })
  if (!res.ok) {
    const err = new Error('Failed to reach the game catalog provider')
    err.statusCode = res.status
    throw err
  }
  return res.json()
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const clientId = process.env.IGDB_CLIENT_ID
  const token = await getAppToken()

  const params = req.query || {}
  const q = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const offset = (page - 1) * PAGE_SIZE
  const fields = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'

  let games
  let hasMore
  let count

  if (q) {
    // IGDB's fuzzy "search" matches any title containing the term (lots of
    // obscure noise). Pull a larger candidate pool once and re-rank it by
    // popularity so well-known games surface first, then paginate locally.
    const CANDIDATE_POOL = 200
    const candidatesBody = `search "${escapeQuery(q)}"; where version_parent = null; fields ${fields}; limit ${CANDIDATE_POOL};`
    const candidates = await igdbFetch('games', candidatesBody, clientId, token)
    const sorted = (candidates || []).slice().sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))
    games = sorted.slice(offset, offset + PAGE_SIZE)
    count = sorted.length
    hasMore = offset + PAGE_SIZE < sorted.length
  } else {
    const gamesBody = `fields ${fields}; where version_parent = null; sort total_rating_count desc; limit ${PAGE_SIZE}; offset ${offset};`
    const countBody = 'where version_parent = null;'
    const [gamesRes, countRes] = await Promise.all([
      igdbFetch('games', gamesBody, clientId, token),
      igdbFetch('games/count', countBody, clientId, token)
    ])
    games = gamesRes
    count = countRes?.count || 0
    hasMore = offset + PAGE_SIZE < count
  }

  const results = (games || []).map((g) => ({
    id: g.id,
    title: g.name,
    cover: g.cover?.url ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_big') : null,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results, hasMore, count })
})
