import { defineStore } from 'pinia'
import { api } from '../utils/api'

export const usePageViewsStore = defineStore('pageViews', {
  state: () => ({
    weekly: null,
    tracked: false
  }),
  actions: {
    // Counts one real page load (hard navigation / refresh), not every
    // in-app SPA route change -- guarded so App.vue's onMounted (which
    // could in principle re-fire) never double-counts within one visit.
    async trackAndLoad() {
      if (this.tracked) return
      this.tracked = true
      try {
        const [, res] = await Promise.all([
          api.post('/page-views', {}),
          api.get('/page-views')
        ])
        this.weekly = res.views
      } catch {
        // A failed counter ping/read shouldn't be visible to anyone.
      }
    }
  }
})
