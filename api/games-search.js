import { sendJson, withErrors } from './_utils/response.js'

const PAGE_SIZE = 24

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) {
    return sendJson(res, 500, {
      error: 'RAWG_API_KEY is not configured on the server. Get a free key at rawg.io/apidocs and set it in Vercel env vars.'
    })
  }

  const params = req.query || {}
  const q = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1', 10))

  const url = new URL('https://api.rawg.io/api/games')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('page', String(page))
  url.searchParams.set('page_size', String(PAGE_SIZE))
  if (q) {
    url.searchParams.set('search', q)
    url.searchParams.set('search_precise', 'true')
  } else {
    url.searchParams.set('ordering', '-added')
  }

  const upstream = await fetch(url)
  if (!upstream.ok) {
    return sendJson(res, upstream.status, { error: 'Failed to reach the game catalog provider' })
  }
  const data = await upstream.json()

  const results = (data.results || []).map((g) => ({
    id: g.id,
    title: g.name,
    cover: g.background_image || null,
    rating: g.rating || null,
    released: g.released || null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results, hasMore: !!data.next, count: data.count || 0 })
})
