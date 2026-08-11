import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch } from './_utils/igdb.js'

export default withErrors(async (req, res) => {
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
})
