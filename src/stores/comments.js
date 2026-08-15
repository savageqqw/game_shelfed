import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { useAuthStore } from './auth'

export const useCommentsStore = defineStore('comments', {
  state: () => ({
    comments: [],
    loaded: false,
    loading: false,
    posting: false
  }),
  actions: {
    async fetchAll() {
      const auth = useAuthStore()
      if (!auth.isAuthed) return
      this.loading = true
      try {
        const res = await api.get('/comments-list', auth.token)
        this.comments = res.comments || []
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async add(body) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')
      this.posting = true
      try {
        const res = await api.post('/comments-add', { body }, auth.token)
        this.comments.unshift(res.comment)
        return res.comment
      } finally {
        this.posting = false
      }
    },
    async remove(id) {
      const auth = useAuthStore()
      if (!auth.isAuthed) throw new Error('not-authed')
      await api.post('/comments-delete', { id }, auth.token)
      this.comments = this.comments.filter((c) => c.id !== id)
    },
    reset() {
      this.comments = []
      this.loaded = false
    }
  }
})
