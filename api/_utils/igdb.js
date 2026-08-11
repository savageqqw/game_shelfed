// Cached across warm invocations of this function instance.
let cachedToken = null
let cachedExpiry = 0

export async function getIgdbToken() {
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

export function escapeIgdbQuery(q) {
  return q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function igdbFetch(path, body) {
  const clientId = process.env.IGDB_CLIENT_ID
  const token = await getIgdbToken()
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

const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'

function mapGame(g) {
  return {
    id: g.id,
    title: g.name,
    cover: g.cover?.url ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_big') : null,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }
}

// Best-effort single-result lookup used for matching an external title
// (e.g. a Steam app name) to our IGDB-backed catalog.
export async function igdbBestMatch(title) {
  const body = `search "${escapeIgdbQuery(title)}"; where version_parent = null; fields ${FIELDS}; limit 8;`
  const candidates = await igdbFetch('games', body)
  if (!candidates?.length) return null
  const sorted = candidates.slice().sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))
  return mapGame(sorted[0])
}

export { mapGame as mapIgdbGame }
