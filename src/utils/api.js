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
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: (path, token, params) => request(path, { method: 'GET', token, params }),
  post: (path, body, token) => request(path, { method: 'POST', body, token })
}
