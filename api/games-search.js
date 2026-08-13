import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch, escapeIgdbQuery } from './_utils/igdb.js'

const PAGE_SIZE = 24
const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'
// Pool of currently-popular games to shuffle the default (no-query) listing
// from. Kept well-rated/well-known only, not the entire catalog.
const POPULAR_POOL_SIZE = 400
const POPULAR_WHERE = 'version_parent = null & total_rating_count > 20'

// Small deterministic PRNG so the same seed always produces the same shuffle
// order (needed so "load more" pagination doesn't repeat/skip games within
// one page load), while a fresh seed (new page load) gives a fresh order.
function seededShuffle(arr, seed) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  function rand() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const params = req.query || {}
  const q = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let games
  let hasMore
  let count
  let catalogTotal = null

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
    // Default catalog view: a random order over currently-popular games,
    // stable for the duration of one page load (same seed) so "load more"
    // doesn't repeat games, but different on every fresh visit/reload.
    const seed = String(params.seed || 'static')
    const poolBody = `fields ${FIELDS}; where ${POPULAR_WHERE}; sort total_rating_count desc; limit ${POPULAR_POOL_SIZE};`
    const totalCountBody = 'where version_parent = null;'
    const [pool, totalCountRes] = await Promise.all([
      igdbFetch('games', poolBody),
      igdbFetch('games/count', totalCountBody)
    ])
    const shuffled = seededShuffle(pool || [], seed)
    games = shuffled.slice(offset, offset + PAGE_SIZE)
    count = shuffled.length
    hasMore = offset + PAGE_SIZE < shuffled.length
    // This is the real size of the whole IGDB catalog (hundreds of
    // thousands), separate from the 400-game pool we shuffle for display --
    // that pool size should never leak into the "games in catalog" stat.
    catalogTotal = totalCountRes?.count || null
  }

  const results = (games || []).map((g) => ({
    id: g.id,
    title: g.name,
    cover: g.cover?.url ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_big') : null,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results, hasMore, count, catalogTotal })
})
