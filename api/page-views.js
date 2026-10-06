import { getClient, ensureSchema } from './_utils/db.js'
import { optionalUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { isAdmin } from './_utils/admin.js'

// Crawlers, link previewers, audit tools and headless browsers that run JS
// and would otherwise look like visitors.
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|mediapartners|bingpreview|facebookexternalhit|embedly|whatsapp|telegrambot|discordbot|skypeuripreview|slackbot|vkshare|headless|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|monitor|vercel|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\/|libwww|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|yandex(?!browser)|baidu|bytespider|gptbot|claudebot|anthropic|perplexity|ccbot|applebot|amazonbot|duckduck|sogou|exabot|seznam|qwant/i

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$|\.local(:\d+)?$/i

function today() {
  return new Date().toISOString().slice(0, 10)
}

function describeUa(ua) {
  const os = /windows/i.test(ua) ? 'Windows'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /mac os x|macintosh/i.test(ua) ? 'macOS'
    : /cros/i.test(ua) ? 'ChromeOS'
    : /linux/i.test(ua) ? 'Linux'
    : 'Other'
  const browser = /edg\//i.test(ua) ? 'Edge'
    : /opr\/|opera/i.test(ua) ? 'Opera'
    : /yabrowser/i.test(ua) ? 'Yandex'
    : /samsungbrowser/i.test(ua) ? 'Samsung'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /safari/i.test(ua) ? 'Safari'
    : 'Other'
  const kind = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop'
  return `${browser} · ${os} · ${kind}`
}

function hostOf(raw) {
  try {
    return new URL(raw).host
  } catch {
    return ''
  }
}

// where the visit came from: an explicit ?utm_source / ?ref, else the
// referring site's host (our own host counts as "direct")
function sourceOf(body, ownHost) {
  const tag = String(body.source || '').trim().slice(0, 80)
  if (tag) return `utm:${tag}`
  const host = hostOf(String(body.referrer || '')).replace(/^www\./, '')
  if (!host || host === ownHost.replace(/^www\./, '')) return null
  return host.slice(0, 80)
}

async function track(req, res) {
  const body = req.body || {}
  const ua = String(req.headers['user-agent'] || '')
  const ownHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  const pageHost = hostOf(String(req.headers.origin || req.headers.referer || ''))

  // local dev servers proxying to production, and the owner's own browser
  if (LOCAL_HOST.test(pageHost) || body.owner === true) return sendJson(res, 200, { ok: true, counted: false })

  await ensureSchema()
  const db = getClient()

  const user = optionalUser(req)
  if (user && await isAdmin(db, user)) return sendJson(res, 200, { ok: true, counted: false, owner: true })

  const isBot = !ua || BOT_UA.test(ua) || body.webdriver === true
  const rawId = body.visitorId ? String(body.visitorId).slice(0, 64) : null
  const visitorId = user ? `u:${user.id}` : rawId
  const device = describeUa(ua)
  const source = sourceOf(body, ownHost)
  const country = String(req.headers['x-vercel-ip-country'] || '').slice(0, 2) || null
  const path = String(body.path || '/').slice(0, 120)

  let isNew = false
  if (!isBot && (user || rawId)) {
    const seen = await db.execute({
      sql: user ? 'SELECT 1 FROM visits WHERE user_id = ? LIMIT 1' : 'SELECT 1 FROM visits WHERE visitor_id = ? LIMIT 1',
      args: [user ? user.id : rawId]
    })
    isNew = seen.rows.length === 0
  }

  const writes = [{
    sql: `INSERT INTO visits (user_id, username, visitor_id, is_new_visitor, device, referrer, country, path, is_bot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [user?.id ?? null, user?.username ?? null, rawId, isNew ? 1 : 0, device, source, country, path, isBot ? 1 : 0]
  }]
  if (!isBot) {
    writes.push({
      sql: `INSERT INTO page_views (day, count) VALUES (?, 1)
            ON CONFLICT(day) DO UPDATE SET count = count + 1`,
      args: [today()]
    })
    if (visitorId) {
      writes.push({ sql: 'INSERT OR IGNORE INTO visitor_days (day, visitor_id) VALUES (?, ?)', args: [today(), visitorId] })
    }
  }
  // keep the raw log from growing forever
  if (Math.random() < 0.02) writes.push("DELETE FROM visits WHERE created_at < datetime('now', '-120 days')")

  await db.batch(writes, 'write')
  sendJson(res, 200, { ok: true, counted: !isBot })
}

// public counter in the footer: distinct people over the last 7 days
async function weekly(req, res) {
  await ensureSchema()
  const db = getClient()
  const result = await db.execute(
    "SELECT COUNT(DISTINCT visitor_id) AS total FROM visitor_days WHERE day >= date('now', '-6 days')"
  )
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300')
  sendJson(res, 200, { visitors: Number(result.rows[0]?.total || 0) })
}

async function recent(req, res) {
  await ensureSchema()
  const db = getClient()
  const user = optionalUser(req)
  if (!(await isAdmin(db, user))) return sendJson(res, 403, { error: 'Forbidden' })

  const one = (sql) => db.execute(sql).then((r) => Number(r.rows[0]?.[0] || 0))

  const [visitors7d, visitorsToday, visitorsPrev7d, sessions7d, bots7d, signups7d, usersTotal, daily, sources, countries, devices, signupSources, list] = await Promise.all([
    one("SELECT COUNT(DISTINCT visitor_id) FROM visitor_days WHERE day >= date('now', '-6 days')"),
    one("SELECT COUNT(*) FROM visitor_days WHERE day = date('now')"),
    one("SELECT COUNT(DISTINCT visitor_id) FROM visitor_days WHERE day BETWEEN date('now', '-13 days') AND date('now', '-7 days')"),
    one("SELECT COALESCE(SUM(count), 0) FROM page_views WHERE day >= date('now', '-6 days')"),
    one("SELECT COUNT(*) FROM visits WHERE is_bot = 1 AND created_at >= datetime('now', '-7 days')"),
    one("SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')"),
    one('SELECT COUNT(*) FROM users'),
    db.execute("SELECT day, COUNT(*) AS n FROM visitor_days WHERE day >= date('now', '-13 days') GROUP BY day ORDER BY day"),
    db.execute(`SELECT COALESCE(referrer, '') AS k, COUNT(*) AS n FROM visits
                WHERE is_bot = 0 AND device IS NOT NULL AND created_at >= datetime('now', '-7 days')
                GROUP BY k ORDER BY n DESC LIMIT 6`),
    db.execute(`SELECT COALESCE(country, '') AS k, COUNT(*) AS n FROM visits
                WHERE is_bot = 0 AND device IS NOT NULL AND created_at >= datetime('now', '-7 days')
                GROUP BY k ORDER BY n DESC LIMIT 6`),
    db.execute(`SELECT CASE WHEN device LIKE '%mobile' OR device LIKE '%tablet' THEN 'mobile' ELSE 'desktop' END AS k, COUNT(*) AS n FROM visits
                WHERE is_bot = 0 AND device IS NOT NULL AND created_at >= datetime('now', '-7 days')
                GROUP BY k`),
    db.execute(`SELECT COALESCE(signup_source, '') AS k, COUNT(*) AS n FROM users
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY k ORDER BY n DESC LIMIT 8`),
    db.execute(`SELECT id, created_at, user_id, username, visitor_id, is_new_visitor, device, referrer, country, path, is_bot
                FROM visits ORDER BY id DESC LIMIT 80`)
  ])

  const pairs = (r) => r.rows.map((row) => ({ key: row.k, count: Number(row.n) }))

  res.setHeader('Cache-Control', 'no-store')
  sendJson(res, 200, {
    summary: { visitors7d, visitorsToday, visitorsPrev7d, sessions7d, bots7d, signups7d, usersTotal },
    daily: daily.rows.map((r) => ({ day: r.day, visitors: Number(r.n) })),
    sources: pairs(sources),
    countries: pairs(countries),
    devices: pairs(devices),
    signupSources: pairs(signupSources),
    visits: list.rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      username: r.username,
      isGuest: !r.user_id,
      isNewVisitor: !!r.is_new_visitor,
      isBot: !!r.is_bot,
      device: r.device || null,
      source: r.referrer || null,
      country: r.country || null,
      path: r.path || null
    }))
  })
}

export default withErrors(async (req, res) => {
  if (req.method === 'POST') return track(req, res)
  if (req.method === 'GET') {
    if (req.query?.scope === 'recent') return recent(req, res)
    return weekly(req, res)
  }
  sendJson(res, 405, { error: 'Method not allowed' })
})
