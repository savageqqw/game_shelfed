import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { getAdminId } from './_utils/admin.js'

async function list(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  const db = getClient()

  const q = String(req.query?.q || '').trim()

  const [result, adminId] = await Promise.all([
    db.execute(
      q
        ? {
            sql: `
              SELECT u.id, u.username, u.avatar, u.created_at,
                     COUNT(li.id) AS game_count
              FROM users u
              LEFT JOIN library_items li ON li.user_id = u.id
              WHERE u.username LIKE ?
              GROUP BY u.id
              ORDER BY game_count DESC, u.username ASC
            `,
            args: [`%${q}%`]
          }
        : `
            SELECT u.id, u.username, u.avatar, u.created_at,
                   COUNT(li.id) AS game_count
            FROM users u
            LEFT JOIN library_items li ON li.user_id = u.id
            GROUP BY u.id
            ORDER BY game_count DESC, u.username ASC
          `
    ),
    getAdminId(db)
  ])

  const users = result.rows.map((r) => ({
    username: r.username,
    avatar: r.avatar || null,
    createdAt: r.created_at,
    gameCount: r.game_count,
    isAdmin: adminId != null && Number(r.id) === adminId
  }))

  sendJson(res, 200, { users })
}

async function profile(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const username = (req.query?.username || '').trim()
  if (!username) return sendJson(res, 400, { error: 'username required' })

  await ensureSchema()
  const db = getClient()

  // oldest account first, so a later look-alike name can't shadow it
  const userRes = await db.execute({
    sql: 'SELECT id, username, avatar, steam_id, created_at FROM users WHERE username = ? COLLATE NOCASE ORDER BY id LIMIT 1',
    args: [username]
  })
  const userRow = userRes.rows[0]
  if (!userRow) return sendJson(res, 404, { error: 'not-found' })

  const [itemsRes, adminId] = await Promise.all([
    db.execute({
      sql: `SELECT game_id, title, cover, status, rating, genres, released, catalog_rating
            FROM library_items WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [userRow.id]
    }),
    getAdminId(db)
  ])

  sendJson(res, 200, {
    username: userRow.username,
    avatar: userRow.avatar || null,
    steamLinked: !!userRow.steam_id,
    createdAt: userRow.created_at,
    isAdmin: adminId != null && Number(userRow.id) === adminId,
    items: itemsRes.rows
  })
}

export default withErrors(async (req, res) => {
  requireUser(req) // both actions require being logged in
  switch (req.query.action) {
    case 'list': return list(req, res)
    case 'profile': return profile(req, res)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
