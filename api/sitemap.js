import { getClient, ensureSchema } from './_utils/db.js'

const SITE = 'https://game-shelfed.pp.ua'

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

export default async function handler(req, res) {
  const urls = [
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/login`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE}/register`, changefreq: 'monthly', priority: '0.3' }
  ]

  try {
    await ensureSchema()
    const db = getClient()
    // Only games that are actually in someone's library have a page worth
    // indexing (real, non-generic content: our own status/rating data) --
    // and only plain-numeric ids resolve to a real /game/:id (see
    // GameCard's isLinkable), so Steam-only imports are excluded here too.
    const result = await db.execute(
      "SELECT DISTINCT game_id, MAX(updated_at) AS last_updated FROM library_items WHERE game_id GLOB '[0-9]*' GROUP BY game_id LIMIT 5000"
    )
    for (const row of result.rows) {
      urls.push({
        loc: `${SITE}/game/${row.game_id}`,
        lastmod: row.last_updated ? String(row.last_updated).slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: '0.6'
      })
    }
  } catch (e) {
    // A DB hiccup shouldn't take the whole sitemap down -- fall back to
    // just the static routes above.
    console.error('sitemap: failed to load game list', e)
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(body)
}
