import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch, escapeIgdbQuery } from './_utils/igdb.js'

const PAGE_SIZE = 24
const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const params = req.query || {}
  const q = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let games
  let hasMore
  let count

  if (q) {
    // IGDB's fuzzy "search" matches any title containing the term (lots of
    // obscure noise). Pull a larger candidate pool once and re-rank it by
    // popularity so well-known games surface first, then paginate locally.
    const CANDIDATE_POOL = 200
    const candidatesBody = `search "${escapeIgdbQuery(q)}"; where version_parent = null; fields ${FIELDS}; limit ${CANDIDATE_POOL};`
    const candidates = await igdbFetch('games', candidatesBody)
    const sorted = (candidates || []).slice().sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))
    games = sorted.slice(offset, offset + PAGE_SIZE)
    count = sorted.length
    hasMore = offset + PAGE_SIZE < sorted.length
  } else {
    const gamesBody = `fields ${FIELDS}; where version_parent = null; sort total_rating_count desc; limit ${PAGE_SIZE}; offset ${offset};`
    const countBody = 'where version_parent = null;'
    const [gamesRes, countRes] = await Promise.all([
      igdbFetch('games', gamesBody),
      igdbFetch('games/count', countBody)
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
