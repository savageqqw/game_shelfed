import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

function getVisitorId() {
  let id = localStorage.getItem('gl_visitor_id')
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('gl_visitor_id', id)
  }
  return id
}

export const usePageViewsStore = defineStore('pageViews', {
  state: () => ({
    weekly: null,
    tracked: false,
    recent: [],
    recentLoading: false
  }),
  actions: {
    // Counts one real page load (hard navigation / refresh), not every
    // in-app SPA route change -- guarded so App.vue's onMounted (which
    // could in principle re-fire) never double-counts within one visit.
    async trackAndLoad() {
      if (this.tracked) return
      this.tracked = true
      const auth = useAuthStore()
      try {
        const [, res] = await Promise.all([
          api.post('/page-views', { visitorId: getVisitorId() }, auth.token || undefined),
          api.get('/page-views')
        ])
        this.weekly = res.views
      } catch {
        // A failed counter ping/read shouldn't be visible to anyone.
      }
    },
    // Admin-only: who's been on the site lately, and whether it was them,
    // a known user, or a new vs. returning guest.
    async fetchRecent() {
      const auth = useAuthStore()
      if (!auth.isAuthed) return
      this.recentLoading = true
      try {
        const res = await api.get('/page-views', auth.token, { scope: 'recent' })
        this.recent = res.visits || []
      } catch {
        this.recent = []
      } finally {
        this.recentLoading = false
      }
    }
  }
})
