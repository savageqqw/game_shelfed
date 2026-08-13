import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

export const useSteamAchievementsStore = defineStore('steamAchievements', {
  state: () => ({
    byAppId: {}, // appid -> { unlocked, total, percent }
    requestedAppIds: new Set(),
    loading: false
  }),
  actions: {
    // Fetches achievement completion for any of the given appids we haven't
    // already asked about, in one batched request, and caches the results
    // for the rest of the session.
    async ensureLoadedFor(appids) {
      const auth = useAuthStore()
      if (!auth.isAuthed) return

      const toFetch = [...new Set(appids)].filter((id) => id != null && !this.requestedAppIds.has(id))
      if (!toFetch.length) return
      toFetch.forEach((id) => this.requestedAppIds.add(id))

      this.loading = true
      try {
        const res = await api.post('/steam-achievements', { appids: toFetch }, auth.token)
        this.byAppId = { ...this.byAppId, ...(res.results || {}) }
      } catch {
        // Steam unreachable, private profile, expired session, etc -- cards
        // just show no achievement badge, same as games without stats.
      } finally {
        this.loading = false
      }
    },
    percentFor(appid) {
      if (appid == null) return null
      const entry = this.byAppId[appid]
      return entry ? entry.percent : null
    },
    // True when an achieved achievement's text reads like a "you beat the
    // game" moment, even if the overall % is below 100 (side/MP achievements).
    storyCompleteFor(appid) {
      if (appid == null) return false
      return !!this.byAppId[appid]?.storyComplete
    },
    reset() {
      this.byAppId = {}
      this.requestedAppIds = new Set()
      this.loading = false
    }
  }
})
