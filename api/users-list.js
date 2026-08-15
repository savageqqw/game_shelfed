import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
  requireUser(req) // must be logged in to browse the user directory

  await ensureSchema()
  const db = getClient()

  const q = String(req.query?.q || '').trim()

  const result = await db.execute(
    q
      ? {
          sql: `
            SELECT u.username, u.avatar, u.created_at,
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
          SELECT u.username, u.avatar, u.created_at,
                 COUNT(li.id) AS game_count
          FROM users u
          LEFT JOIN library_items li ON li.user_id = u.id
          GROUP BY u.id
          ORDER BY game_count DESC, u.username ASC
        `
  )

  const users = result.rows.map((r) => ({
    username: r.username,
    avatar: r.avatar || null,
    createdAt: r.created_at,
    gameCount: r.game_count,
    isAdmin: r.username.toLowerCase() === ADMIN_USERNAME
  }))

  sendJson(res, 200, { users })
})
