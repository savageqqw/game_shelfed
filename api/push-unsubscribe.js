import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  requireUser(req)

  const endpoint = req.body?.endpoint
  if (!endpoint) return sendJson(res, 400, { error: 'endpoint required' })

  await ensureSchema()
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] })

  sendJson(res, 200, { ok: true })
})
