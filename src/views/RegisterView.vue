<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { steamStartHref } from '../utils/attribution'
import { useSeo } from '../composables/useSeo'

const steamHref = steamStartHref()

const { t } = useI18n()

useSeo(() => ({
  title: t('nav.register'),
  description: t('auth.registerSubtitle'),
  path: '/register'
}))
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
    <div class="auth-card">
      <span class="tape">{{ t('nav.register') }}</span>
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
        <p class="legal-note">
          {{ t('auth.privacyNote') }}
          <router-link :to="{ name: 'privacy' }">{{ t('auth.privacyLink') }}</router-link>
        </p>
      </form>

      <div class="divider"><span>{{ t('auth.orDivider') }}</span></div>

      <a :href="steamHref" class="btn btn-steam">
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
.legal-note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2);
  text-align: center;
}
.legal-note a { color: var(--text-1); }
.legal-note a:hover { color: var(--acid); }
.auth-view {
  display: flex;
  justify-content: center;
  padding: 36px 0 40px;
}
.auth-card {
  position: relative;
  width: 100%;
  max-width: 450px;
  padding: 32px 32px 28px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line-strong);
  border-radius: var(--radius-lg);
  box-shadow: 10px 10px 0 var(--acid);
}
/* little punched hole, like a hang tag */
.auth-card::before {
  content: '';
  position: absolute;
  top: 18px;
  right: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: var(--stroke) solid var(--line-strong);
  background: var(--bg-0);
}
.auth-card h1 { font-size: clamp(26px, 3vw, 32px); font-weight: 800; margin-top: 18px; }
.subtitle { color: var(--text-1); font-size: 15px; margin: 10px 0 26px; line-height: 1.5; }

.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-1);
}
.auth-form label .input { font-family: var(--font-body); letter-spacing: 0; text-transform: none; }

.submit-btn { width: 100%; min-height: 50px; margin-top: 6px; font-size: 15px; }
.error-msg {
  color: var(--st-dropped);
  font-size: 13px;
  margin: 0;
  padding: 10px 12px;
  border: 1.5px solid var(--st-dropped);
  border-radius: var(--radius-sm);
  background: rgba(255, 79, 94, 0.08);
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0 18px;
  color: var(--text-2);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 2px;
  background: repeating-linear-gradient(90deg, var(--line-strong) 0 6px, transparent 6px 10px);
}

.btn-steam {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid #2a475e;
  background: #1b2838;
  color: #c7d5e0;
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), color var(--dur-fast), border-color var(--dur-fast);
}
.btn-steam:hover { transform: translate(-2px, -2px); box-shadow: 3px 3px 0 #66c0f4; border-color: #66c0f4; color: #fff; }

.switch-line { text-align: center; margin: 22px 0 0; font-size: 14px; color: var(--text-2); }
.switch-line a {
  color: var(--acid);
  font-weight: 700;
  text-decoration: none;
  margin-left: 4px;
  border-bottom: 2px solid currentColor;
}
.switch-line a:hover { color: var(--paper); }

@media (max-width: 480px) {
  .auth-view { padding: 16px 0 40px; }
  .auth-card { padding: 26px 20px 22px; box-shadow: 6px 6px 0 var(--acid); }
}
</style>
