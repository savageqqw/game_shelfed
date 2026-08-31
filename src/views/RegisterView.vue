<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()
const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')

async function submit() {
  const ok = await auth.register(username.value, email.value, password.value)
  if (ok) {
    await library.fetchAll()
    router.push({ name: 'my-games' })
  }
}
</script>

<template>
  <div class="shell auth-view">
    <div class="auth-card card-surface">
      <h1>{{ t('auth.registerTitle') }}</h1>
      <p class="subtitle">{{ t('auth.registerSubtitle') }}</p>

      <form @submit.prevent="submit" class="auth-form">
        <label>
          <span>{{ t('auth.username') }}</span>
          <input v-model="username" type="text" class="input" required minlength="2" autocomplete="username" />
        </label>
        <label>
          <span>{{ t('auth.email') }}</span>
          <input v-model="email" type="email" class="input" required autocomplete="email" />
        </label>
        <label>
          <span>{{ t('auth.password') }}</span>
          <input v-model="password" type="password" class="input" required minlength="6" autocomplete="new-password" />
        </label>

        <p v-if="auth.error" class="error-msg">{{ auth.error }}</p>

        <button class="btn btn-primary submit-btn" :disabled="auth.loading" type="submit">
          {{ t('auth.registerBtn') }}
        </button>
      </form>

      <div class="divider"><span>{{ t('auth.orDivider') }}</span></div>

      <a href="/api/auth-steam-start" class="btn btn-steam">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.99 2 2.87 5.8 2.14 10.73l5.15 2.13a2.7 2.7 0 0 1 1.53-.47c.05 0 .1 0 .15.01l2.29-3.32v-.05a3.65 3.65 0 1 1 3.65 3.65h-.08l-3.27 2.33v.13a2.7 2.7 0 0 1-4.34 2.14L2.5 15.8C3.79 19.42 7.6 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2ZM8.3 17.5l-1.18-.49a1.98 1.98 0 0 0 1.02.9 2.02 2.02 0 0 0 2.63-1.1 2 2 0 0 0-1.09-2.62 2 2 0 0 0-1.52-.01l1.22.5a1.47 1.47 0 1 1-1.08 2.72v.1Zm7.65-6.34a2.44 2.44 0 1 1 0-4.87 2.44 2.44 0 0 1 0 4.87Zm0-.73a1.7 1.7 0 1 0 0-3.41 1.7 1.7 0 0 0 0 3.41Z" />
        </svg>
        {{ t('auth.steamCta') }}
      </a>

      <p class="switch-line">
        {{ t('auth.haveAccount') }}
        <router-link :to="{ name: 'login' }">{{ t('auth.switchToLogin') }}</router-link>
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

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
  color: var(--text-2);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.btn-steam {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: #1b2838;
  color: #fdfaf2;
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
  transition: filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.btn-steam:hover { filter: brightness(1.15); transform: translateY(-1px); }

.switch-line { text-align: center; margin-top: 22px; font-size: 13px; color: var(--text-2); }
.switch-line a { color: var(--accent-amber-2); font-weight: 700; text-decoration: none; margin-left: 4px; }

@media (max-width: 480px) {
  .auth-view { padding: 40px 14px 80px; }
  .auth-card { padding: 24px; }
}
</style>
