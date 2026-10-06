// Remembers which ad, post or site brought a person here, so a sign-up days
// later can still be credited to it. The last non-direct source wins and is
// kept for 30 days; nothing leaves the browser until the person registers.

const KEY = 'gs_src'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode etc. */ }
}

function clean(v) {
  return String(v || '').replace(/[\u0000-\u001f<>"]/g, '').trim().slice(0, 80)
}

// the source named in the landing URL itself: utm tags, ?ref= or an ad
// network's click id
export function currentTouch() {
  const p = new URLSearchParams(location.search)
  const utm = ['utm_source', 'utm_medium', 'utm_campaign'].map((k) => clean(p.get(k))).filter(Boolean)
  if (p.get('utm_source') && utm.length) return utm.join('/').slice(0, 80)
  if (p.get('ref')) return clean(p.get('ref'))
  if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) return 'google/cpc'
  if (p.get('fbclid')) return 'facebook'
  if (p.get('ttclid')) return 'tiktok/cpc'
  return ''
}

function referrerHost() {
  try {
    if (!document.referrer) return ''
    const host = new URL(document.referrer).hostname.replace(/^www\./, '')
    return host === location.hostname.replace(/^www\./, '') ? '' : clean(host)
  } catch {
    return ''
  }
}

// call once at startup, before the router rewrites the URL
export function captureAttribution() {
  const source = currentTouch() || referrerHost()
  if (source) storageSet(KEY, JSON.stringify({ source, at: Date.now() }))
}

export function attributionSource() {
  try {
    const saved = JSON.parse(storageGet(KEY) || 'null')
    if (!saved || Date.now() - saved.at > MAX_AGE_MS) return ''
    return clean(saved.source)
  } catch {
    return ''
  }
}

// "Sign in with Steam" leaves the site, so the source rides along in the URL
export function steamStartHref() {
  const src = attributionSource()
  return src ? `/api/auth-steam-start?src=${encodeURIComponent(src)}` : '/api/auth-steam-start'
}
