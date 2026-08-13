import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

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
})
