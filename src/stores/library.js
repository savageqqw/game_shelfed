import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

export const STATUSES = ['completed', 'playing', 'dropped', 'planned']

export const STATUS_ICONS = {
  completed: '✓',
  playing: '▶',
  dropped: '✕',
  planned: '▤'
}

function parseDbDate(raw) {
  if (!raw) return 0
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const t = new Date(normalized).getTime()
  return Number.isNaN(t) ? 0 : t
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    items: [],   // [{ id, game_id, title, cover, status, rating, updated_at }]
    loaded: false,
    loading: false
  }),
  getters: {
    byStatus: (state) => (status) => {
      const list = state.items.filter((i) => i.status === status)
      if (status === 'completed') {
        // most recently completed first, not just most recently touched
        return [...list].sort((a, b) => {
          const bd = parseDbDate(b.completed_at) || parseDbDate(b.updated_at)
          const ad = parseDbDate(a.completed_at) || parseDbDate(a.updated_at)
          return bd - ad
        })
      }
      return list
    },
    entryFor: (state) => (gameId) => state.items.find((i) => String(i.game_id) === String(gameId)),
    counts: (state) => {
      const c = { planned: 0, playing: 0, completed: 0, dropped: 0 }
      for (const i of state.items) c[i.status] = (c[i.status] || 0) + 1
      return c
    }
  },
  actions: {
    async fetchAll() {
      const auth = useAuthStore()
      if (!auth.isAuthed) return
      this.loading = true
      try {
        const res = await api.get('/library-list', auth.token)
        this.items = res.items
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async upsert(game, status) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')

      const idx = this.items.findIndex((i) => String(i.game_id) === String(game.id))
      const prev = idx >= 0 ? { ...this.items[idx] } : null

      // Optimistic UI: reflect the new status immediately instead of making
      // the person wait for the round-trip before the card/tab updates.
      const optimistic = {
        ...(prev || {}),
        game_id: game.id,
        title: game.title,
        cover: game.cover,
        status,
        genres: game.genres || prev?.genres || null,
        released: game.released || prev?.released || null,
        catalog_rating: typeof game.rating === 'number' ? game.rating : prev?.catalog_rating ?? null,
        rating: prev?.rating ?? null,
        updated_at: new Date().toISOString()
      }
      if (idx >= 0) this.items[idx] = optimistic
      else this.items.push(optimistic)

      try {
        const res = await api.post('/library-upsert', {
          game_id: game.id,
          title: game.title,
          cover: game.cover,
          status,
          genres: game.genres || null,
          released: game.released || null,
          catalog_rating: typeof game.rating === 'number' ? game.rating : null
        }, auth.token)
        const i = this.items.findIndex((it) => String(it.game_id) === String(game.id))
        if (i >= 0) this.items[i] = res.item
        else this.items.push(res.item)
        return res.item
      } catch (e) {
        // Roll back on failure.
        const i = this.items.findIndex((it) => String(it.game_id) === String(game.id))
        if (i >= 0) {
          if (prev) this.items[i] = prev
          else this.items.splice(i, 1)
        }
        throw e
      }
    },
    async remove(gameId) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')

      const idx = this.items.findIndex((i) => String(i.game_id) === String(gameId))
      const prev = idx >= 0 ? this.items[idx] : null
      if (idx >= 0) this.items.splice(idx, 1)

      try {
        await api.post('/library-delete', { game_id: gameId }, auth.token)
      } catch (e) {
        if (prev) this.items.splice(idx, 0, prev)
        throw e
      }
    },
    async rate(gameId, rating) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')

      const idx = this.items.findIndex((i) => String(i.game_id) === String(gameId))
      const prevRating = idx >= 0 ? this.items[idx].rating : undefined
      if (idx >= 0) this.items[idx] = { ...this.items[idx], rating }

      try {
        const res = await api.post('/library-rate', { game_id: gameId, rating }, auth.token)
        const i = this.items.findIndex((it) => String(it.game_id) === String(gameId))
        if (i >= 0) this.items[i] = res.item
        return res.item
      } catch (e) {
        const i = this.items.findIndex((it) => String(it.game_id) === String(gameId))
        if (i >= 0 && prevRating !== undefined) this.items[i] = { ...this.items[i], rating: prevRating }
        throw e
      }
    },
    // Per-game deal-drop notification threshold. percent: null resets to
    // account default, 0 mutes the game, 1-90 sets a custom threshold.
    // Only meaningful while status is 'planned'.
    async setDealThreshold(gameId, percent) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')

      const idx = this.items.findIndex((i) => String(i.game_id) === String(gameId))
      const prevPercent = idx >= 0 ? this.items[idx].deal_threshold_percent : undefined
      if (idx >= 0) this.items[idx] = { ...this.items[idx], deal_threshold_percent: percent }

      try {
        const res = await api.post('/library-deal-threshold', { game_id: gameId, percent }, auth.token)
        const i = this.items.findIndex((it) => String(it.game_id) === String(gameId))
        if (i >= 0) this.items[i] = res.item
        return res.item
      } catch (e) {
        const i = this.items.findIndex((it) => String(it.game_id) === String(gameId))
        if (i >= 0 && prevPercent !== undefined) this.items[i] = { ...this.items[i], deal_threshold_percent: prevPercent }
        throw e
      }
    },
    // Games added before genres/released/catalog_rating were tracked have
    // no metadata saved. Quietly fetch and persist it once, in the background.
    async backfillMeta() {
      const auth = useAuthStore()
      if (!auth.isAuthed) return
      const missing = this.items.filter((i) => !i.genres && !i.released && i.catalog_rating == null)
      if (!missing.length) return

      const ids = missing.map((i) => i.game_id).join(',')
      let details
      try {
        details = await api.get('/games-details', auth.token, { ids })
      } catch {
        return
      }
      const byId = new Map((details.results || []).map((r) => [String(r.id), r]))

      for (const item of missing) {
        const d = byId.get(String(item.game_id))
        if (!d || (!d.genres?.length && !d.released && d.rating == null)) continue
        try {
          const res = await api.post('/library-backfill-meta', {
            game_id: item.game_id,
            genres: d.genres || null,
            released: d.released || null,
            catalog_rating: d.rating ?? null
          }, auth.token)
          const idx = this.items.findIndex((i) => String(i.game_id) === String(item.game_id))
          if (idx >= 0) this.items[idx] = res.item
        } catch {
          // best-effort; skip on failure
        }
      }
    },
    reset() {
      this.items = []
      this.loaded = false
    }
  }
})
