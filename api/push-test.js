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

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

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
})
