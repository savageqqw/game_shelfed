import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch, escapeIgdbQuery } from './_utils/igdb.js'

const PAGE_SIZE = 24
const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'
// Pool of currently-popular games to shuffle the default (no-query) listing
// from. Kept well-rated/well-known only, not the entire catalog.
const POPULAR_POOL_SIZE = 400
const POPULAR_WHERE = 'version_parent = null & total_rating_count > 20'
// Official site = 1, Steam = 13 in IGDB's website category enum.
const WEBSITE_CATEGORY = { OFFICIAL: 1, STEAM: 13 }

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

async function search(req, res) {
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
    const CANDIDATE_POOL = 200
    const candidatesBody = `search "${escapeIgdbQuery(q)}"; where version_parent = null; fields ${FIELDS}; limit ${CANDIDATE_POOL};`
    const candidates = await igdbFetch('games', candidatesBody)
    const sorted = (candidates || []).slice().sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))
    games = sorted.slice(offset, offset + PAGE_SIZE)
    count = sorted.length
    hasMore = offset + PAGE_SIZE < sorted.length
  } else {
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
}

async function details(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const idsParam = (req.query?.ids || '').trim()
  const ids = idsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, 50)

  if (!ids.length) return sendJson(res, 200, { results: [] })

  const body = `where id = (${ids.join(',')}); fields id,rating,first_release_date,genres.name; limit ${ids.length};`
  const games = await igdbFetch('games', body)

  const results = (games || []).map((g) => ({
    id: g.id,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results })
}

async function detail(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const id = parseInt(req.query?.id, 10)
  if (!Number.isFinite(id)) return sendJson(res, 400, { error: 'id is required' })

  const body = `
    where id = ${id};
    fields name, summary, cover.url, screenshots.url, genres.name, platforms.name,
           first_release_date, rating, total_rating_count,
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           websites.url, websites.category,
           similar_games.name, similar_games.cover.url;
  `
  const games = await igdbFetch('games', body)
  const g = games?.[0]
  if (!g) return sendJson(res, 404, { error: 'not-found' })

  const developers = (g.involved_companies || []).filter((c) => c.developer).map((c) => c.company?.name).filter(Boolean)
  const publishers = (g.involved_companies || []).filter((c) => c.publisher).map((c) => c.company?.name).filter(Boolean)
  const official = (g.websites || []).find((w) => w.category === WEBSITE_CATEGORY.OFFICIAL)
  const steam = (g.websites || []).find((w) => w.category === WEBSITE_CATEGORY.STEAM)

  sendJson(res, 200, {
    id: g.id,
    title: g.name,
    summary: g.summary || null,
    cover: g.cover?.url ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_big') : null,
    screenshots: (g.screenshots || []).map((s) => 'https:' + s.url.replace('t_thumb', 't_screenshot_big')),
    genres: (g.genres || []).map((x) => x.name),
    platforms: (g.platforms || []).map((x) => x.name),
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    ratingCount: g.total_rating_count || 0,
    developers,
    publishers,
    officialUrl: official?.url || null,
    steamUrl: steam?.url || null,
    similarGames: (g.similar_games || [])
      .filter((s) => s.name)
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        title: s.name,
        cover: s.cover?.url ? 'https:' + s.cover.url.replace('t_thumb', 't_cover_big') : null
      }))
  })
}

export default withErrors(async (req, res) => {
  switch (req.query.action) {
    case 'search': return search(req, res)
    case 'details': return details(req, res)
    case 'detail': return detail(req, res)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
