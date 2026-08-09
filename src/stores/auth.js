import { defineStore } from 'pinia'
import { api } from '../utils/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('gl_token') || null,
    user: JSON.parse(localStorage.getItem('gl_user') || 'null'),
    error: null,
    loading: false
  }),
  getters: {
    isAuthed: (state) => !!state.token
  },
  actions: {
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('gl_token', token)
      localStorage.setItem('gl_user', JSON.stringify(user))
    },
    async register(username, email, password) {
      this.loading = true
      this.error = null
      try {
        const res = await api.post('/auth-register', { username, email, password })
        this.setSession(res.token, res.user)
        return true
      } catch (e) {
        this.error = e.message
        return false
      } finally {
        this.loading = false
      }
    },
    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const res = await api.post('/auth-login', { email, password })
        this.setSession(res.token, res.user)
        return true
      } catch (e) {
        this.error = e.message
        return false
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('gl_token')
      localStorage.removeItem('gl_user')
    }
  }
})
