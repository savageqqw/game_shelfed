import webpush from 'web-push'
import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

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

async function subscribe(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const sub = req.body || {}
  const endpoint = sub.endpoint
  const p256dh = sub.keys?.p256dh
  const auth = sub.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return sendJson(res, 400, { error: 'Invalid push subscription' })
  }

  await ensureSchema()
  const db = getClient()
  // Same browser/device re-subscribing (or a different account on the same
  // browser) just overwrites the row for that endpoint.
  await db.execute({
    sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    args: [user.id, endpoint, p256dh, auth]
  })

  sendJson(res, 200, { ok: true })
}

async function unsubscribe(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const endpoint = req.body?.endpoint
  if (!endpoint) return sendJson(res, 400, { error: 'endpoint required' })

  await ensureSchema()
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] })

  sendJson(res, 200, { ok: true })
}

async function test(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  configureWebPush()
  await ensureSchema()
  const db = getClient()

  const subs = await db.execute({ sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?', args: [user.id] })
  if (!subs.rows.length) return sendJson(res, 400, { error: 'no-subscription' })

  const payload = JSON.stringify({
    title: 'Game Shelfed',
    body: 'Тестове повідомлення — сповіщення про знижки працюють.',
    url: '/my-games'
  })

  let sent = 0
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [s.endpoint] })
      }
    }
  }

  if (!sent) return sendJson(res, 502, { error: 'send-failed' })
  sendJson(res, 200, { sent })
}

export default withErrors(async (req, res) => {
  const action = req.query.action
  // subscribe/test need the account; unsubscribe just needs a valid token
  // (it targets a device endpoint, not the account row).
  const user = requireUser(req)
  switch (action) {
    case 'subscribe': return subscribe(req, res, user)
    case 'unsubscribe': return unsubscribe(req, res)
    case 'test': return test(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
