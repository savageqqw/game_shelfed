import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch, escapeIgdbQuery, mapIgdbGame } from './_utils/igdb.js'
import { getClient, ensureSchema } from './_utils/db.js'
import { verifyToken } from './_utils/auth.js'

const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'
const POOL_SIZE = 40
const RESULT_SIZE = 12

// Not full-blown ML -- just: look at genres the person already plays/finished,
// pull a bigger-than-needed pool of well-rated games in those genres, and
// return a random slice of it. Randomizing the slice (instead of always the
// top N by rating) is what keeps the row from showing identical tiles on
// every visit.
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function optionalUser(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return verifyToken(header.slice(7))
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const user = optionalUser(req)
  let topGenres = []
  let excludeIds = new Set()

  if (user) {
    await ensureSchema()
    const db = getClient()
    const rows = await db.execute({
      sql: `SELECT game_id, genres FROM library_items WHERE user_id = ? AND status IN ('completed', 'playing')`,
      args: [user.id]
    })

    const allLib = await db.execute({ sql: 'SELECT game_id FROM library_items WHERE user_id = ?', args: [user.id] })
    excludeIds = new Set(allLib.rows.map((r) => String(r.game_id)))

    const genreCounts = new Map()
    for (const row of rows.rows) {
      let list = []
      try {
        list = row.genres ? JSON.parse(row.genres) : []
      } catch {
        list = []
      }
      for (const g of list) genreCounts.set(g, (genreCounts.get(g) || 0) + 1)
    }
    topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
  }

  let candidates = []

  if (topGenres.length) {
    const genreClause = topGenres.map((g) => `"${escapeIgdbQuery(g)}"`).join(',')
    const body = `fields ${FIELDS}; where version_parent = null & genres.name = (${genreClause}) & total_rating_count > 20; sort total_rating_count desc; limit ${POOL_SIZE};`
    candidates = (await igdbFetch('games', body)) || []
  }

  // Not enough genre-matched candidates (new account, obscure taste, etc)
  // -- top up with generally popular titles instead of returning a short row.
  if (candidates.length < RESULT_SIZE) {
    const body = `fields ${FIELDS}; where version_parent = null; sort total_rating_count desc; limit ${POOL_SIZE};`
    const popular = (await igdbFetch('games', body)) || []
    const seen = new Set(candidates.map((c) => c.id))
    for (const g of popular) {
      if (!seen.has(g.id)) candidates.push(g)
    }
  }

  const filtered = candidates.filter((g) => !excludeIds.has(String(g.id)))
  const picked = shuffle(filtered).slice(0, RESULT_SIZE).map(mapIgdbGame)

  sendJson(res, 200, { results: picked, basedOnGenres: topGenres })
})
