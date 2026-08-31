export function sendJson(res, status, data) {
  res.status(status)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.json(data)
}

export function withErrors(fn) {
  return async (req, res) => {
    if (req.method === 'OPTIONS') return sendJson(res, 200, {})
    try {
      await fn(req, res)
    } catch (e) {
      const status = e.statusCode || 500
      if (status === 500) console.error(e)
      sendJson(res, status, { error: e.message || 'Server error' })
    }
  }
}
