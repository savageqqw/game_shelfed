import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

export const STATUSES = ['planned', 'playing', 'completed', 'dropped']

export const useLibraryStore = defineStore('library', {
  state: () => ({
    items: [],   // [{ id, game_id, title, cover, status, rating, updated_at }]
    loaded: false,
    loading: false
  }),
  getters: {
    byStatus: (state) => (status) => state.items.filter((i) => i.status === status),
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
      const res = await api.post('/library-upsert', {
        game_id: game.id,
        title: game.title,
        cover: game.cover,
        status
      }, auth.token)
      const idx = this.items.findIndex((i) => String(i.game_id) === String(game.id))
      if (idx >= 0) this.items[idx] = res.item
      else this.items.push(res.item)
      return res.item
    },
    async remove(gameId) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')
      await api.post('/library-delete', { game_id: gameId }, auth.token)
      this.items = this.items.filter((i) => String(i.game_id) !== String(gameId))
    },
    async rate(gameId, rating) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')
      const res = await api.post('/library-rate', { game_id: gameId, rating }, auth.token)
      const idx = this.items.findIndex((i) => String(i.game_id) === String(gameId))
      if (idx >= 0) this.items[idx] = res.item
      return res.item
    },
    reset() {
      this.items = []
      this.loaded = false
    }
  }
})
