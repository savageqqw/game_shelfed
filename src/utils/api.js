const BASE = '/api'

async function request(path, { method = 'GET', body, token, params } = {}) {
  let url = `${BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    if (qs) url += `?${qs}`
  }
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  let data = null
  try { data = await res.json() } catch { /* no body */ }

  if (!res.ok) {
    // a stored token that the server no longer accepts (expired after 30
    // days, or the secret changed): let the app sign out instead of leaving
    // every request failing behind a "logged in" UI
    if (res.status === 401 && token) window.dispatchEvent(new CustomEvent('gs:session-expired'))
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.code = data?.code || null
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (path, token, params) => request(path, { method: 'GET', token, params }),
  post: (path, body, token) => request(path, { method: 'POST', body, token })
}
