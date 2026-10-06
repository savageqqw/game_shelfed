import { getClient, ensureSchema } from './_utils/db.js'
import { igdbFetch } from './_utils/igdb.js'

const SITE = 'https://game-shelfed.pp.ua'
const SITE_NAME = 'Game Shelfed'
const DEFAULT_IMAGE = `${SITE}/og-cover.png`

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

async function sitemap(req, res) {
  const urls = [
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/donate`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${SITE}/privacy`, changefreq: 'yearly', priority: '0.2' },
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

// --- link previews -------------------------------------------------------
// Telegram, Facebook, Discord and the like read a page's meta tags without
// running JavaScript, so on this SPA they'd see the same home-page card for
// every link. vercel.json routes only those preview bots here; this returns
// the real index.html with the tags for the requested page swapped in, so
// even a person who somehow lands here still gets the working app.

const STATIC_PAGES = {
  '/': {
    title: `${SITE_NAME} · усі твої ігри на одній полиці`,
    description: 'Знайди будь-яку гру в каталозі на 370 тисяч, постав на полицю й відмічай: пройдено, граю, в планах чи кинуто. Є імпорт зі Steam і сповіщення про знижки.'
  },
  '/donate': {
    title: `Підтримати ${SITE_NAME}`,
    description: 'Game Shelfed безкоштовний і тримається на донатах. Банка Monobank і криптогаманці: ETH, SOL, TRC-20, BSC, Base.'
  },
  '/privacy': {
    title: `Політика конфіденційності · ${SITE_NAME}`,
    description: 'Які дані збирає Game Shelfed, навіщо вони потрібні і як усе видалити.'
  },
  '/register': {
    title: `Реєстрація · ${SITE_NAME}`,
    description: 'Створи свою полицю ігор за хвилину або увійди через Steam і перенеси бібліотеку.'
  },
  '/login': {
    title: `Вхід · ${SITE_NAME}`,
    description: 'Увійди, щоб далі вести облік своїх ігор.'
  }
}

function htmlEscape(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
}

function igdbImage(url, size) {
  return url ? 'https:' + url.replace('t_thumb', size) : null
}

async function gameMeta(id) {
  const body = `where id = ${id}; fields name, summary, cover.url, artworks.url, screenshots.url, first_release_date, genres.name; limit 1;`
  const g = (await igdbFetch('games', body))?.[0]
  if (!g) return null
  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null
  const genres = (g.genres || []).slice(0, 3).map((x) => x.name).join(', ')
  const facts = [year, genres].filter(Boolean).join(' · ')
  // wide key art makes a big preview card; the portrait cover is the fallback
  const wide = igdbImage(g.artworks?.[0]?.url || g.screenshots?.[0]?.url, 't_screenshot_big')
  return {
    title: `${g.name} · ${SITE_NAME}`,
    description: `${g.name}${facts ? ` (${facts})` : ''}. Додай гру на свою полицю, постав статус і оцінку, глянь скріншоти й схожі ігри.`,
    image: wide || igdbImage(g.cover?.url, 't_cover_big'),
    wideImage: !!wide
  }
}

let shellCache = { html: null, at: 0 }
async function loadShell(req) {
  if (shellCache.html && Date.now() - shellCache.at < 10 * 60 * 1000) return shellCache.html
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const r = await fetch(`https://${host}/index.html`)
  if (!r.ok) throw new Error(`index.html ${r.status}`)
  shellCache = { html: await r.text(), at: Date.now() }
  return shellCache.html
}

function metaBlock(m, url) {
  const card = m.wideImage === false ? 'summary' : 'summary_large_image'
  return [
    `<title>${htmlEscape(m.title)}</title>`,
    `<meta name="description" content="${htmlEscape(m.description)}" />`,
    `<link rel="canonical" href="${htmlEscape(url)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:locale" content="uk_UA" />',
    `<meta property="og:title" content="${htmlEscape(m.title)}" />`,
    `<meta property="og:description" content="${htmlEscape(m.description)}" />`,
    `<meta property="og:image" content="${htmlEscape(m.image)}" />`,
    `<meta property="og:url" content="${htmlEscape(url)}" />`,
    `<meta name="twitter:card" content="${card}" />`,
    `<meta name="twitter:title" content="${htmlEscape(m.title)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(m.description)}" />`,
    `<meta name="twitter:image" content="${htmlEscape(m.image)}" />`
  ].join('\n    ')
}

async function share(req, res) {
  const raw = String(req.query?.path || '/')
  const path = ('/' + raw.replace(/^\/+/, '')).replace(/\/+$/, '') || '/'

  let meta = STATIC_PAGES[path] || null
  const gameMatch = path.match(/^\/game\/(\d{1,10})$/)
  if (gameMatch) {
    try {
      meta = await gameMeta(Number(gameMatch[1]))
    } catch (e) {
      console.error('share: game lookup failed', e)
    }
  }
  if (!meta) meta = STATIC_PAGES['/']
  meta = { image: DEFAULT_IMAGE, ...meta }

  const url = `${SITE}${path === '/' ? '/' : path}`
  const block = metaBlock(meta, url)

  let html
  try {
    const shell = await loadShell(req)
    html = shell
      .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
      .replace(/<meta\s+(?:name|property)="(?:description|og:[\w:]+|twitter:[\w:]+)"[^>]*>\s*/gi, '')
      .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
      .replace(/<\/head>/i, `  ${block}\n  </head>`)
  } catch (e) {
    console.error('share: shell fetch failed', e)
    html = `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" />\n    ${block}\n</head><body><a href="${htmlEscape(url)}">${htmlEscape(meta.title)}</a></body></html>`
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
  res.status(200).send(html)
}

export default async function handler(req, res) {
  if (req.query?.action === 'share') return share(req, res)
  return sitemap(req, res)
}
