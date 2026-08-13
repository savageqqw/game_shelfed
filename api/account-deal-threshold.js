import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const percent = parseInt(req.body?.percent, 10)
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
    return sendJson(res, 400, { error: 'percent must be between 1 and 90' })
  }

  await ensureSchema()
  const db = getClient()
  await db.execute({
    sql: 'UPDATE users SET deal_threshold_percent = ? WHERE id = ?',
    args: [percent, user.id]
  })

  sendJson(res, 200, { dealThresholdPercent: percent })
})
