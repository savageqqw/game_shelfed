import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: localStorage.getItem('gl_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  }),
  actions: {
    apply() {
      document.documentElement.setAttribute('data-theme', this.theme)
    },
    toggle() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('gl_theme', this.theme)
      this.apply()
    },
    init() {
      this.apply()
    }
  }
})
