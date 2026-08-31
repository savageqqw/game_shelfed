import { getClient, ensureSchema } from './_utils/db.js'
import { requireUser } from './_utils/auth.js'
import { sendJson, withErrors } from './_utils/response.js'
import { upsertLibraryItem, VALID_STATUSES } from './_utils/library.js'

const VALID_RATINGS = ['like', 'dislike', 'mixed']
const ITEM_COLUMNS = 'id, game_id, title, cover, status, rating, genres, released, catalog_rating, playtime_minutes, deal_threshold_percent, completed_at, updated_at'

async function list(req, res, user) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: `SELECT ${ITEM_COLUMNS} FROM library_items WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [user.id]
  })

  sendJson(res, 200, { items: result.rows })
}

async function upsert(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

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
}

async function rate(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { game_id, rating } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })
  if (rating !== null && !VALID_RATINGS.includes(rating)) {
    return sendJson(res, 400, { error: 'Invalid rating' })
  }

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: `UPDATE library_items SET rating = ?, updated_at = datetime('now') WHERE user_id = ? AND game_id = ?
          RETURNING ${ITEM_COLUMNS}`,
    args: [rating, user.id, String(game_id)]
  })
  if (!result.rows[0]) return sendJson(res, 404, { error: 'Item not found in library' })

  sendJson(res, 200, { item: result.rows[0] })
}

async function remove(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { game_id } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  await ensureSchema()
  const db = getClient()

  await db.execute({
    sql: 'DELETE FROM library_items WHERE user_id = ? AND game_id = ?',
    args: [user.id, String(game_id)]
  })

  sendJson(res, 200, { ok: true })
}

// percent semantics for library_items.deal_threshold_percent:
//   null/undefined -> reset to the account-wide default threshold
//   0               -> mute deal notifications entirely for this game
//   1-90            -> a custom threshold just for this game
async function dealThreshold(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { game_id } = req.body || {}
  let { percent } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  if (percent === undefined || percent === null || percent === '') {
    percent = null
  } else {
    percent = parseInt(percent, 10)
    if (!Number.isFinite(percent) || percent < 0 || percent > 90) {
      return sendJson(res, 400, { error: 'percent must be between 0 and 90' })
    }
  }

  await ensureSchema()
  const db = getClient()

  const result = await db.execute({
    sql: `UPDATE library_items SET deal_threshold_percent = ? WHERE user_id = ? AND game_id = ?
          RETURNING ${ITEM_COLUMNS}`,
    args: [percent, user.id, String(game_id)]
  })
  if (!result.rows.length) return sendJson(res, 404, { error: 'Not in library' })

  sendJson(res, 200, { item: result.rows[0] })
}

async function backfillMeta(req, res, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const { game_id, genres, released, catalog_rating } = req.body || {}
  if (!game_id) return sendJson(res, 400, { error: 'game_id is required' })

  await ensureSchema()
  const db = getClient()

  const genresJson = Array.isArray(genres) && genres.length ? JSON.stringify(genres.slice(0, 3)) : null
  const catalogRatingVal = typeof catalog_rating === 'number' ? catalog_rating : null

  await db.execute({
    sql: `UPDATE library_items SET genres = ?, released = ?, catalog_rating = ? WHERE user_id = ? AND game_id = ?`,
    args: [genresJson, released || null, catalogRatingVal, user.id, String(game_id)]
  })

  const result = await db.execute({
    sql: `SELECT ${ITEM_COLUMNS} FROM library_items WHERE user_id = ? AND game_id = ?`,
    args: [user.id, String(game_id)]
  })
  if (!result.rows[0]) return sendJson(res, 404, { error: 'Item not found in library' })

  sendJson(res, 200, { item: result.rows[0] })
}

export default withErrors(async (req, res) => {
  const user = requireUser(req)
  switch (req.query.action) {
    case 'list': return list(req, res, user)
    case 'upsert': return upsert(req, res, user)
    case 'rate': return rate(req, res, user)
    case 'delete': return remove(req, res, user)
    case 'deal-threshold': return dealThreshold(req, res, user)
    case 'backfill-meta': return backfillMeta(req, res, user)
    default: return sendJson(res, 404, { error: 'Unknown action' })
  }
})
