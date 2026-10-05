import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

// set once the server recognises the admin, so the owner's own visits stay
// out of the stats even when they browse logged out
export const OWNER_KEY = 'gs_owner'
const SESSION_KEY = 'gs_visit_at'
const SESSION_MS = 30 * 60 * 1000
// a visit counts only after the tab has been visible this long, which
// filters out prerenders and things that open the page and leave instantly
const ENGAGE_MS = 3000

function storageGet(store, key) {
  try { return store.getItem(key) } catch { return null }
}
function storageSet(store, key, value) {
  try { store.setItem(key, value) } catch { /* private mode etc. */ }
}

function getVisitorId() {
  let id = storageGet(localStorage, 'gl_visitor_id')
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`
    storageSet(localStorage, 'gl_visitor_id', id)
  }
  return id
}

function isLocalHost() {
  const h = location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local')
}

function afterVisibleFor(ms) {
  return new Promise((resolve) => {
    let timer = null
    const start = () => {
      if (document.visibilityState === 'visible' && !timer) timer = setTimeout(done, ms)
    }
    const onChange = () => {
      if (document.visibilityState === 'visible') start()
      else if (timer) { clearTimeout(timer); timer = null }
    }
    function done() {
      document.removeEventListener('visibilitychange', onChange)
      resolve()
    }
    document.addEventListener('visibilitychange', onChange)
    start()
  })
}

export function markOwnerDevice() {
  storageSet(localStorage, OWNER_KEY, '1')
}

export const usePageViewsStore = defineStore('pageViews', {
  state: () => ({
    weekly: null,
    tracked: false,
    stats: null,
    statsLoading: false
  }),
  actions: {
    // One visit per tab session (30 min), sent only from the real site,
    // never from the owner's browser or an automated one.
    async trackAndLoad() {
      if (this.tracked) return
      this.tracked = true

      api.get('/page-views')
        .then((res) => { this.weekly = res.visitors ?? null })
        .catch(() => {})

      if (isLocalHost() || storageGet(localStorage, OWNER_KEY) === '1') return
      const last = Number(storageGet(sessionStorage, SESSION_KEY) || 0)
      if (Date.now() - last < SESSION_MS) return

      await afterVisibleFor(ENGAGE_MS)
      storageSet(sessionStorage, SESSION_KEY, String(Date.now()))

      const auth = useAuthStore()
      const params = new URLSearchParams(location.search)
      try {
        const res = await api.post('/page-views', {
          visitorId: getVisitorId(),
          path: location.pathname,
          referrer: document.referrer || '',
          source: params.get('utm_source') || params.get('ref') || '',
          webdriver: navigator.webdriver === true
        }, auth.token || undefined)
        if (res?.owner) markOwnerDevice()
      } catch {
        // a failed counter ping shouldn't be visible to anyone
      }
    },
    // admin only: visitor numbers, sources and the raw visit log
    async fetchStats() {
      const auth = useAuthStore()
      if (!auth.isAuthed) return
      this.statsLoading = true
      try {
        this.stats = await api.get('/page-views', auth.token, { scope: 'recent' })
      } catch {
        this.stats = null
      } finally {
        this.statsLoading = false
      }
    }
  }
})
