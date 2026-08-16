import { sendJson, withErrors } from './_utils/response.js'
import { igdbFetch } from './_utils/igdb.js'

// Official site = 1, Steam = 13 in IGDB's website category enum.
const WEBSITE_CATEGORY = { OFFICIAL: 1, STEAM: 13 }

export default withErrors(async (req, res) => {
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
})
