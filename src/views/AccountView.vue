<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES } from '../stores/library'
import { api } from '../utils/api'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()

const info = ref(null)
const infoLoading = ref(true)
const infoError = ref(null)

const linkNotice = ref(null) // { type: 'success' | 'error', text }

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwLoading = ref(false)
const pwError = ref(null)
const pwSuccess = ref(false)

const localeMap = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' }

function formatDate(iso) {
  if (!iso) return ''
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(localeMap[locale.value] || undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

async function loadInfo() {
  infoLoading.value = true
  infoError.value = null
  try {
    info.value = await api.get('/account-info', auth.token)
  } catch (e) {
    infoError.value = e.message
  } finally {
    infoLoading.value = false
  }
}

async function submitPasswordChange() {
  pwError.value = null
  pwSuccess.value = false

  if (newPassword.value !== confirmPassword.value) {
    pwError.value = t('account.password.mismatch')
    return
  }

  pwLoading.value = true
  try {
    await api.post('/account-change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    }, auth.token)
    pwSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    pwError.value = e.message
  } finally {
    pwLoading.value = false
  }
}

onMounted(() => {
  loadInfo()
  if (!library.loaded) library.fetchAll()

  if (route.query.steamLinked) {
    linkNotice.value = { type: 'success', text: t('account.steamLinkSuccess') }
    router.replace({ query: {} })
  } else if (route.query.steamError) {
    const errorKeys = {
      already_linked: 'account.steamLinkAlreadyUsed',
      session_expired: 'account.steamLinkExpired',
      link_token_invalid: 'account.steamLinkExpired'
    }
    const knownText = errorKeys[route.query.steamError] ? t(errorKeys[route.query.steamError]) : t('account.steamLinkFailed')
    const debugSuffix = route.query.debug ? ` [${route.query.steamError}: ${route.query.debug}]` : ` [${route.query.steamError}]`
    linkNotice.value = { type: 'error', text: knownText + debugSuffix }
    router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="shell account-view">
    <header class="account-header">
      <h1>{{ t('account.title') }}</h1>
      <p class="subtitle">{{ t('account.subtitle') }}</p>
    </header>

    <p v-if="linkNotice" class="link-notice" :class="linkNotice.type">{{ linkNotice.text }}</p>

    <section class="card-surface info-card">
      <div v-if="infoLoading" class="loading-msg mono">{{ t('search.loading') }}</div>
      <p v-else-if="infoError" class="error-msg">{{ infoError }}</p>
      <template v-else>
        <div v-if="info.avatar || info.steamLinked" class="identity-row">
          <img v-if="info.avatar" :src="info.avatar" alt="" class="account-avatar" />
          <span v-if="info.steamLinked" class="steam-badge">{{ t('account.steamLinked') }}</span>
        </div>
        <dl class="info-grid">
          <div class="info-row">
            <dt>{{ t('account.username') }}</dt>
            <dd>{{ info.username }}</dd>
          </div>
          <div class="info-row">
            <dt>{{ t('account.email') }}</dt>
            <dd>{{ info.email }}</dd>
          </div>
          <div class="info-row">
            <dt>{{ t('account.memberSince') }}</dt>
            <dd>{{ formatDate(info.createdAt) }}</dd>
          </div>
        </dl>

        <a
          v-if="!info.steamLinked"
          :href="`/api/auth-steam-start?link_token=${encodeURIComponent(auth.token)}`"
          class="btn btn-steam link-steam-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.99 2 2.87 5.8 2.14 10.73l5.15 2.13a2.7 2.7 0 0 1 1.53-.47c.05 0 .1 0 .15.01l2.29-3.32v-.05a3.65 3.65 0 1 1 3.65 3.65h-.08l-3.27 2.33v.13a2.7 2.7 0 0 1-4.34 2.14L2.5 15.8C3.79 19.42 7.6 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2ZM8.3 17.5l-1.18-.49a1.98 1.98 0 0 0 1.02.9 2.02 2.02 0 0 0 2.63-1.1 2 2 0 0 0-1.09-2.62 2 2 0 0 0-1.52-.01l1.22.5a1.47 1.47 0 1 1-1.08 2.72v.1Zm7.65-6.34a2.44 2.44 0 1 1 0-4.87 2.44 2.44 0 0 1 0 4.87Zm0-.73a1.7 1.7 0 1 0 0-3.41 1.7 1.7 0 0 0 0 3.41Z" />
          </svg>
          {{ t('account.linkSteamCta') }}
        </a>
      </template>
    </section>

    <section class="stats-section">
      <h2>{{ t('account.statsTitle') }}</h2>
      <ul class="stat-row">
        <li class="stat-item s-total">
          <span class="stat-label"><span class="dot" />{{ t('account.totalGames') }}</span>
          <span class="stat-num mono">{{ library.items.length }}</span>
        </li>
        <li v-for="s in STATUSES" :key="s" class="stat-item" :class="`s-${s}`">
          <span class="stat-label"><span class="dot" />{{ t(`status.${s}`) }}</span>
          <span class="stat-num mono">{{ library.counts[s] || 0 }}</span>
        </li>
      </ul>
    </section>

    <section v-if="library.items.length" class="card-surface activity-card">
      <h2>{{ t('account.activity.title') }}</h2>
      <p class="activity-subtitle">{{ t('account.activity.subtitle') }}</p>
      <ActivityHeatmap :items="library.items" />
    </section>

    <section v-if="!infoLoading && !info?.steamLinked" class="card-surface password-card">
      <h2>{{ t('account.password.title') }}</h2>
      <form @submit.prevent="submitPasswordChange" class="auth-form">
        <label>
          <span>{{ t('account.password.current') }}</span>
          <input v-model="currentPassword" type="password" class="input" required autocomplete="current-password" />
        </label>
        <label>
          <span>{{ t('account.password.new') }}</span>
          <input v-model="newPassword" type="password" class="input" required minlength="6" autocomplete="new-password" />
        </label>
        <label>
          <span>{{ t('account.password.confirm') }}</span>
          <input v-model="confirmPassword" type="password" class="input" required minlength="6" autocomplete="new-password" />
        </label>

        <p v-if="pwError" class="error-msg">{{ pwError }}</p>
        <p v-if="pwSuccess" class="success-msg">{{ t('account.password.success') }}</p>

        <button class="btn btn-primary submit-btn" :disabled="pwLoading" type="submit">
          {{ t('account.password.submit') }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.account-view { padding-bottom: 60px; }
.account-header { padding: 20px 0 28px; }
.account-header h1 { font-size: clamp(26px, 4vw, 36px); }
.subtitle { color: var(--text-2); font-size: 14px; margin-top: 8px; }

.info-card { padding: 28px 32px; margin-bottom: 32px; }
.identity-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.account-avatar { width: 52px; height: 52px; border-radius: 14px; }
.steam-badge {
  font-size: 11px;
  font-weight: 700;
  color: #66c0f4;
  background: rgba(102, 192, 244, 0.14);
  border: 1px solid rgba(102, 192, 244, 0.3);
  padding: 4px 10px;
  border-radius: 999px;
}
.info-grid { display: flex; flex-direction: column; gap: 14px; }
.info-row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.info-row dt { color: var(--text-2); font-size: 13px; font-weight: 600; }
.info-row dd { margin: 0; font-weight: 700; color: var(--text-0); }

.link-notice {
  font-size: 13px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  margin: 0 0 20px;
}
.link-notice.success { color: var(--status-completed); background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.25); }
.link-notice.error { color: var(--status-dropped); background: rgba(232, 92, 74, 0.1); border: 1px solid rgba(232, 92, 74, 0.25); }

.btn-steam {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 11px 18px;
  border-radius: var(--radius-sm);
  background: #1b2838;
  color: #fdfaf2;
  text-decoration: none;
  font-weight: 700;
  font-size: 13px;
  transition: filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.btn-steam:hover { filter: brightness(1.15); transform: translateY(-1px); }
.link-steam-btn { margin-top: 20px; }

.stats-section { margin-bottom: 32px; }
.stats-section h2, .password-card h2, .activity-card h2 { font-size: 18px; margin-bottom: 16px; }

.activity-card { padding: 28px 32px; margin-bottom: 32px; }
.activity-subtitle { color: var(--text-2); font-size: 13px; margin: -8px 0 20px; }

.stat-row {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  margin: 0;
  padding: 0;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-2);
}
.stat-num { font-size: 24px; font-weight: 700; color: var(--text-0); }
.stat-item.s-total .dot { background: var(--accent-amber); }
.stat-item.s-completed .dot { background: var(--status-completed); }
.stat-item.s-planned .dot { background: var(--status-planned); }
.stat-item.s-playing .dot { background: var(--status-playing); }
.stat-item.s-dropped .dot { background: var(--status-dropped); }

.password-card { padding: 28px 32px; max-width: 440px; }
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-1); font-weight: 600; }

.submit-btn { width: 100%; padding: 12px; margin-top: 6px; }
.error-msg { color: var(--status-dropped); font-size: 13px; margin: 0; }
.success-msg { color: var(--status-completed); font-size: 13px; margin: 0; }
.loading-msg { color: var(--text-2); }
</style>
