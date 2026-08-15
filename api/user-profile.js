import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  requireUser(req)

  const username = (req.query?.username || '').trim()
  if (!username) return sendJson(res, 400, { error: 'username required' })

  await ensureSchema()
  const db = getClient()

  const userRes = await db.execute({
    sql: 'SELECT id, username, avatar, steam_id, created_at FROM users WHERE username = ? COLLATE NOCASE',
    args: [username]
  })
  const userRow = userRes.rows[0]
  if (!userRow) return sendJson(res, 404, { error: 'not-found' })

  const itemsRes = await db.execute({
    sql: `SELECT game_id, title, cover, status, rating, genres, released, catalog_rating
          FROM library_items WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userRow.id]
  })

  sendJson(res, 200, {
    username: userRow.username,
    avatar: userRow.avatar || null,
    steamLinked: !!userRow.steam_id,
    createdAt: userRow.created_at,
    isAdmin: userRow.username.toLowerCase() === ADMIN_USERNAME,
    items: itemsRes.rows
  })
})
