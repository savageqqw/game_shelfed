import webpush from 'web-push'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { findDeals } from './_utils/deals.js'

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!publicKey || !privateKey) {
    const err = new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not configured. See README for setup.')
    err.statusCode = 500
    throw err
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

async function planned(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  await ensureSchema()
  const db = getClient()

  const userRow = await db.execute({ sql: 'SELECT deal_threshold_percent FROM users WHERE id = ?', args: [user.id] })
  const threshold = userRow.rows[0]?.deal_threshold_percent ?? 20

  const plannedRows = await db.execute({
    sql: "SELECT game_id, title, cover, deal_threshold_percent FROM library_items WHERE user_id = ? AND status = 'planned'",
    args: [user.id]
  })

  // deal_threshold_percent per game: NULL -> use account default, 0 -> muted
  // (skip entirely), 1-90 -> custom threshold just for that game.
  const items = plannedRows.rows
    .filter((r) => r.deal_threshold_percent !== 0)
    .map((r) => ({
      game_id: r.game_id,
      title: r.title,
      cover: r.cover,
      threshold: r.deal_threshold_percent ?? threshold
    }))

  if (!items.length) return sendJson(res, 200, { deals: [], threshold })

  res.setHeader('Cache-Control', 'no-store')
  const deals = await findDeals(items)
  sendJson(res, 200, { deals, threshold })
}

async function cron(req, res) {
  // Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
  // invocations when that env var is set -- reject anything else so this
  // endpoint can't be used to spam pushes by hitting it directly.
  const auth = req.headers.authorization || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  configureWebPush()
  await ensureSchema()
  const db = getClient()

  const usersWithSubs = await db.execute(`
    SELECT DISTINCT u.id, u.deal_threshold_percent
    FROM users u
    JOIN push_subscriptions ps ON ps.user_id = u.id
  `)

  let notified = 0
  let usersChecked = 0

  for (const u of usersWithSubs.rows) {
    const threshold = u.deal_threshold_percent ?? 20
    const plannedRows = await db.execute({
      sql: "SELECT game_id, title, cover, deal_threshold_percent FROM library_items WHERE user_id = ? AND status = 'planned'",
      args: [u.id]
    })
    const items = plannedRows.rows
      .filter((r) => r.deal_threshold_percent !== 0)
      .map((r) => ({
        game_id: r.game_id,
        title: r.title,
        cover: r.cover,
        threshold: r.deal_threshold_percent ?? threshold
      }))
    if (!items.length) continue
    usersChecked++

    const deals = await findDeals(items)
    if (!deals.length) continue

    const already = await db.execute({
      sql: 'SELECT appid, discount_percent FROM notified_deals WHERE user_id = ?',
      args: [u.id]
    })
    const alreadyMap = new Map(already.rows.map((r) => [r.appid, r.discount_percent]))
    const fresh = deals.filter((d) => !alreadyMap.has(d.appid) || d.discountPercent > alreadyMap.get(d.appid))
    if (!fresh.length) continue

    const subs = await db.execute({ sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?', args: [u.id] })

    const title = fresh.length === 1
      ? `${fresh[0].title} зі знижкою -${fresh[0].discountPercent}%`
      : `${fresh.length} ігор з планів на знижці`
    const body = fresh.slice(0, 3).map((d) => `${d.title} -${d.discountPercent}%`).join(', ')
    const payload = JSON.stringify({ title, body, url: '/' })

    for (const s of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        notified++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [s.endpoint] })
        }
      }
    }

    for (const d of fresh) {
      await db.execute({
        sql: `INSERT INTO notified_deals (user_id, appid, discount_percent) VALUES (?, ?, ?)
              ON CONFLICT(user_id, appid) DO UPDATE SET discount_percent = excluded.discount_percent, notified_at = CURRENT_TIMESTAMP`,
        args: [u.id, d.appid, d.discountPercent]
      })
    }
  }

  sendJson(res, 200, { usersChecked, notified })
}

export default withErrors(async (req, res) => {
  switch (req.query.action) {
    case 'planned': return planned(req, res)
    case 'cron': return cron(req, res)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
