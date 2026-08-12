import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch } from './_utils/igdb.js'
import { getClient, ensureSchema } from './_utils/db.js'
import { verifyToken } from './_utils/auth.js'

const FIELDS = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'
const RESULT_SIZE = 12
// Games are pulled from several random offsets instead of one big sorted
// pool, so the mix of "quality tiers" varies between loads too, not just
// which exact titles show up.
const BATCH_COUNT = 4
const BATCH_SIZE = 10
// Minimum vote count so we don't surface completely obscure/junk entries,
// while still leaving a huge pool (tens of thousands of games) to sample from.
const BASE_WHERE = 'version_parent = null & total_rating_count > 10'

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

function optionalUser(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return verifyToken(header.slice(7))
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const user = optionalUser(req)
  let excludeIds = new Set()

  if (user) {
    await ensureSchema()
    const db = getClient()
    const allLib = await db.execute({ sql: 'SELECT game_id FROM library_items WHERE user_id = ?', args: [user.id] })
    excludeIds = new Set(allLib.rows.map((r) => String(r.game_id)))
  }

  const countRes = await igdbFetch('games/count', `where ${BASE_WHERE};`)
  const total = countRes?.count || 0

  const candidates = []
  const seen = new Set()

  if (total > 0) {
    const maxOffset = Math.max(0, total - BATCH_SIZE)
    const offsets = Array.from({ length: BATCH_COUNT }, () => Math.floor(Math.random() * (maxOffset + 1)))

    const batches = await Promise.all(
      offsets.map((offset) =>
        igdbFetch(
          'games',
          `fields ${FIELDS}; where ${BASE_WHERE}; sort id asc; offset ${offset}; limit ${BATCH_SIZE};`
        ).catch(() => [])
      )
    )

    for (const batch of batches) {
      for (const g of batch || []) {
        if (seen.has(g.id)) continue
        seen.add(g.id)
        candidates.push(g)
      }
    }
  }

  const filtered = candidates.filter((g) => !excludeIds.has(String(g.id)))
  const picked = shuffle(filtered).slice(0, RESULT_SIZE).map(mapGame)

  sendJson(res, 200, { results: picked })
})
