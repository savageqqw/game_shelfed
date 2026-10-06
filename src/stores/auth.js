import { defineStore } from 'pinia'
import { api } from '../utils/api'
import { i18n } from '../i18n'
import { attributionSource } from '../utils/attribution'
import { trackSignup } from '../utils/ads'

// server errors carry a `code`; show those in the visitor's language
function errorText(e) {
  const key = `auth.errors.${e.code}`
  return e.code && i18n.global.te(key) ? i18n.global.t(key) : e.message
}

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
        const res = await api.post('/auth-register', { username, email, password, source: attributionSource() })
        this.setSession(res.token, res.user)
        trackSignup('email')
        return true
      } catch (e) {
        this.error = errorText(e)
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
        this.error = errorText(e)
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
