import { getClient, ensureSchema } from './_utils/db.js'
import { sendJson, withErrors } from './_utils/response.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default withErrors(async (req, res) => {
  await ensureSchema()
  const db = getClient()

  if (req.method === 'POST') {
    await db.execute({
      sql: `INSERT INTO page_views (day, count) VALUES (?, 1)
            ON CONFLICT(day) DO UPDATE SET count = count + 1`,
      args: [today()]
    })
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: `SELECT COALESCE(SUM(count), 0) AS total FROM page_views
            WHERE day >= date('now', '-6 days')`,
      args: []
    })
    return sendJson(res, 200, { views: Number(result.rows[0]?.total || 0) })
  }

  sendJson(res, 405, { error: 'Method not allowed' })
})
