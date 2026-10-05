import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // API_PROXY_TARGET lets the dev server borrow a deployed API
        // (e.g. https://game-shelfed.pp.ua) when `vercel dev` isn't running
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
