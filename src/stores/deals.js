import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

export const useDealsStore = defineStore('deals', {
  state: () => ({
    deals: [],
    threshold: 20,
    checked: false,
    checking: false,
    dismissed: false
  }),
  actions: {
    // Checked once per session (like the Steam playtime prefetch) -- prices
    // don't change minute to minute, no need to hammer Steam's store API on
    // every navigation.
    async ensureChecked() {
      if (this.checked || this.checking) return
      const auth = useAuthStore()
      if (!auth.isAuthed) return

      this.checking = true
      try {
        const res = await api.get('/planned-deals', auth.token)
        this.deals = res.deals || []
        this.threshold = res.threshold ?? 20
      } catch {
        // Steam unreachable, no planned games, etc -- just show nothing.
      } finally {
        this.checking = false
        this.checked = true
      }
    },
    dismiss() {
      this.dismissed = true
    },
    reset() {
      this.deals = []
      this.threshold = 20
      this.checked = false
      this.checking = false
      this.dismissed = false
    }
  }
})
