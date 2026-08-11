import { ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { upsertLibraryItem, VALID_STATUSES } from './_utils/library.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = requireUser(req)

  const { game_id, title, cover, status, genres, released, catalog_rating } = req.body || {}
  if (!game_id || !title || !status) return sendJson(res, 400, { error: 'game_id, title and status are required' })
  if (!VALID_STATUSES.includes(status)) return sendJson(res, 400, { error: 'Invalid status' })

  await ensureSchema()

  const item = await upsertLibraryItem(user.id, {
    gameId: game_id,
    title,
    cover,
    status,
    genres,
    released,
    catalogRating: typeof catalog_rating === 'number' ? catalog_rating : null
  })

  sendJson(res, 200, { item })
})
