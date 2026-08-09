<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')

async function submit() {
  const ok = await auth.login(email.value, password.value)
  if (ok) {
    await library.fetchAll()
    router.push(route.query.redirect || { name: 'my-games' })
  }
}
</script>

<template>
  <div class="shell auth-view">
    <div class="auth-card card-surface">
      <h1>{{ t('auth.loginTitle') }}</h1>
      <p class="subtitle">{{ t('auth.loginSubtitle') }}</p>

      <form @submit.prevent="submit" class="auth-form">
        <label>
          <span>{{ t('auth.email') }}</span>
          <input v-model="email" type="email" class="input" required autocomplete="email" />
        </label>
        <label>
          <span>{{ t('auth.password') }}</span>
          <input v-model="password" type="password" class="input" required autocomplete="current-password" />
        </label>

        <p v-if="auth.error" class="error-msg">{{ auth.error }}</p>

        <button class="btn btn-primary submit-btn" :disabled="auth.loading" type="submit">
          {{ t('auth.loginBtn') }}
        </button>
      </form>

      <p class="switch-line">
        {{ t('auth.noAccount') }}
        <router-link :to="{ name: 'register' }">{{ t('auth.switchToRegister') }}</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-view {
  display: flex;
  justify-content: center;
  padding: 60px 20px 100px;
}
.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 36px;
}
.auth-card h1 { font-size: 26px; }
.subtitle { color: var(--text-2); font-size: 14px; margin: 8px 0 26px; }

.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-1); font-weight: 600; }

.submit-btn { width: 100%; padding: 12px; margin-top: 6px; }
.error-msg { color: var(--status-dropped); font-size: 13px; margin: 0; }

.switch-line { text-align: center; margin-top: 22px; font-size: 13px; color: var(--text-2); }
.switch-line a { color: var(--accent-amber-2); font-weight: 700; text-decoration: none; margin-left: 4px; }
</style>
