// Who counts as the site admin. Going by username alone let anyone take
// admin rights by registering (or renaming their Steam profile to) the same
// name, so the admin is pinned to one account id: ADMIN_USER_ID if set,
// otherwise the oldest account that carries ADMIN_USERNAME.
export const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'hellraiser').toLowerCase()

let cached = null // { id, at }

export async function getAdminId(db) {
  if (process.env.ADMIN_USER_ID) return Number(process.env.ADMIN_USER_ID)
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.id
  const result = await db.execute({
    sql: 'SELECT MIN(id) AS id FROM users WHERE lower(username) = ?',
    args: [ADMIN_USERNAME]
  })
  const raw = result.rows[0]?.id
  const id = raw == null ? null : Number(raw)
  cached = { id, at: Date.now() }
  return id
}

export async function isAdmin(db, user) {
  if (!user) return false
  const adminId = await getAdminId(db)
  return adminId != null && Number(user.id) === adminId
}
