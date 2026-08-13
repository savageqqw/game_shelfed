import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export const useSteamPlaytimeStore = defineStore('steamPlaytime', {
  state: () => ({
    byAppId: {},
    byTitle: {},
    loaded: false,
    loading: false,
    fetchPromise: null
  }),
  actions: {
    // Fetches once and caches for the rest of the session (app-wide, not
    // per-view) so switching between Library/My Games -- or coming back to
    // My Games later -- shows playtime instantly instead of re-fetching and
    // waiting every single time.
    ensureLoaded() {
      if (this.loaded || this.loading) return this.fetchPromise
      const auth = useAuthStore()
      if (!auth.isAuthed) return Promise.resolve()

      this.loading = true
      this.fetchPromise = api
        .get('/steam-library', auth.token)
        .then((res) => {
          if (res.privacyBlocked || !res.games?.length) return
          const byAppId = {}
          const byTitle = {}
          for (const g of res.games) {
            if (g.appid != null) byAppId[String(g.appid)] = g.playtimeMinutes
            const key = normalizeTitle(g.title)
            if (key) byTitle[key] = g.playtimeMinutes
          }
          this.byAppId = byAppId
          this.byTitle = byTitle
        })
        .catch(() => {
          // Not linked, Steam unreachable, expired session, etc -- cards
          // just show no playtime, same as for games Steam has no record of.
        })
        .finally(() => {
          this.loading = false
          this.loaded = true
        })
      return this.fetchPromise
    },
    playtimeFor(gameId, title) {
      if (String(gameId || '').startsWith('steam:')) {
        const appid = String(gameId).slice('steam:'.length)
        const byAppId = this.byAppId[appid]
        if (typeof byAppId === 'number') return byAppId
      }
      const byTitle = this.byTitle[normalizeTitle(title)]
      return typeof byTitle === 'number' ? byTitle : null
    },
    reset() {
      this.byAppId = {}
      this.byTitle = {}
      this.loaded = false
      this.loading = false
      this.fetchPromise = null
    }
  }
})
