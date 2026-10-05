<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICON_NAMES } from '../stores/library'
import { usePageViewsStore, markOwnerDevice } from '../stores/pageViews'
import { api } from '../utils/api'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import AppIcon from '../components/AppIcon.vue'

const { t, te, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const pageViews = usePageViewsStore()

const localeMap = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' }
const localeTag = computed(() => localeMap[locale.value] || undefined)

function parseDbDate(raw) {
  if (!raw) return null
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(iso) {
  const d = parseDbDate(iso)
  if (!d) return iso || ''
  return d.toLocaleDateString(localeTag.value, { year: 'numeric', month: 'long', day: 'numeric' })
}

const info = ref(null)
const infoLoading = ref(true)
const infoError = ref(null)
const isAdmin = computed(() => !!info.value?.isAdmin)

const linkNotice = ref(null) // { type: 'success' | 'error', text }

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwLoading = ref(false)
const pwError = ref(null)
const pwSuccess = ref(false)

async function loadInfo() {
  infoLoading.value = true
  infoError.value = null
  try {
    info.value = await api.get('/account-info', auth.token)
    if (info.value.isAdmin) {
      // keep this browser out of the visitor stats, even when logged out
      markOwnerDevice()
      pageViews.fetchStats()
    }
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
    const key = `auth.errors.${e.code}`
    pwError.value = e.code && te(key) ? t(key) : e.message
  } finally {
    pwLoading.value = false
  }
}

// ---------------- admin visit stats ----------------
const stats = computed(() => pageViews.stats)

// the last 14 days, oldest first, with empty days filled in
const dailyBars = computed(() => {
  const byDay = new Map((stats.value?.daily || []).map((d) => [d.day, d.visitors]))
  const out = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    out.push({ key, date: d, visitors: byDay.get(key) || 0 })
  }
  return out
})
const dailyMax = computed(() => Math.max(1, ...dailyBars.value.map((b) => b.visitors)))
const dailyPeak = computed(() => {
  let best = null
  for (const b of dailyBars.value) if (b.visitors && (!best || b.visitors >= best.visitors)) best = b
  return best?.key || null
})

function dayLabel(date) {
  return date.toLocaleDateString(localeTag.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const conversionPct = computed(() => {
  const s = stats.value?.summary
  if (!s?.visitors7d) return 0
  return Math.round((s.signups7d / s.visitors7d) * 1000) / 10
})

const regionNames = computed(() => {
  try {
    return new Intl.DisplayNames([localeTag.value || 'en'], { type: 'region' })
  } catch {
    return null
  }
})
function countryLabel(code) {
  if (!code) return t('account.stats.unknown')
  try {
    return regionNames.value?.of(code) || code
  } catch {
    return code
  }
}
function sourceLabel(key) {
  if (!key) return t('account.stats.direct')
  return key.startsWith('utm:') ? key.slice(4) : key
}
function deviceLabel(key) {
  return key === 'mobile' ? t('account.stats.mobile') : t('account.stats.desktop')
}
function share(list, n) {
  const total = (list || []).reduce((sum, x) => sum + x.count, 0)
  return total ? Math.round((n / total) * 100) : 0
}

function visitLabel(v) {
  if (v.isBot) return t('account.stats.bot')
  if (v.username) return v.username
  return v.isNewVisitor ? t('account.visits.newGuest') : t('account.visits.returningGuest')
}
function visitKind(v) {
  if (v.isBot) return 'bot'
  if (v.username) return 'user'
  return v.isNewVisitor ? 'new' : 'returning'
}
function visitMeta(v) {
  return [v.country ? countryLabel(v.country) : null, v.device, v.source ? sourceLabel(v.source) : null, v.path]
    .filter(Boolean)
    .join(' · ')
}
function formatVisitTime(raw) {
  const d = parseDbDate(raw)
  if (!d) return ''
  return d.toLocaleString(localeTag.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
      <span class="tape">{{ t('nav.profile') }}</span>
      <h1>{{ t('account.title') }}</h1>
      <p class="subtitle">{{ t('account.subtitle') }}</p>
    </header>

    <p v-if="linkNotice" class="link-notice" :class="linkNotice.type">{{ linkNotice.text }}</p>

    <div class="top-grid">
      <section class="card info-card">
        <div v-if="infoLoading" class="loading-msg mono">{{ t('search.loading') }}</div>
        <p v-else-if="infoError" class="error-msg">{{ infoError }}</p>
        <template v-else>
          <div class="identity-row">
            <img v-if="info.avatar" :src="info.avatar" alt="" class="account-avatar" />
            <span v-else class="account-avatar avatar-fallback">{{ (info.username || '?').slice(0, 1).toUpperCase() }}</span>
            <div class="identity-text">
              <span class="identity-name">{{ info.username }}</span>
              <span v-if="info.steamLinked" class="steam-badge mono">{{ t('account.steamLinked') }}</span>
            </div>
          </div>
          <dl class="spec">
            <div class="spec-row">
              <dt class="mono">{{ t('account.username') }}</dt>
              <dd>{{ info.username }}</dd>
            </div>
            <div class="spec-row">
              <dt class="mono">{{ t('account.email') }}</dt>
              <dd>{{ info.email }}</dd>
            </div>
            <div class="spec-row">
              <dt class="mono">{{ t('account.memberSince') }}</dt>
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

      <section class="shelf-stats">
        <h2 class="rule-head">{{ t('account.statsTitle') }}</h2>
        <ul class="score">
          <li class="score-tile total">
            <span class="score-label mono">{{ t('account.totalGames') }}</span>
            <span class="score-num mono">{{ String(library.items.length).padStart(2, '0') }}</span>
          </li>
          <li v-for="s in STATUSES" :key="s" class="score-tile" :class="`s-${s}`">
            <span class="score-label mono">
              <span class="score-icon"><AppIcon :name="STATUS_ICON_NAMES[s]" :size="12" :stroke="3" /></span>
              {{ t(`status.${s}`) }}
            </span>
            <span class="score-num mono">{{ String(library.counts[s] || 0).padStart(2, '0') }}</span>
          </li>
        </ul>
      </section>
    </div>

    <section v-if="library.items.length" class="card activity-card">
      <h2 class="card-title">{{ t('account.activity.title') }}</h2>
      <p class="card-sub">{{ t('account.activity.subtitle') }}</p>
      <ActivityHeatmap :items="library.items" />
    </section>

    <!-- ---------- admin: who actually visits ---------- -->
    <section v-if="isAdmin" class="card stats-card">
      <div class="stats-head">
        <div>
          <h2 class="card-title">{{ t('account.stats.title') }}</h2>
          <p class="card-sub">{{ t('account.stats.subtitle') }}</p>
        </div>
        <span class="tape tape-paper">admin</span>
      </div>

      <div v-if="pageViews.statsLoading && !stats" class="loading-msg mono">{{ t('search.loading') }}</div>
      <p v-else-if="!stats" class="error-msg">{{ t('account.stats.loadError') }}</p>
      <template v-else>
        <ul class="kpis">
          <li class="kpi kpi-main">
            <span class="kpi-label mono">{{ t('account.stats.visitors7d') }}</span>
            <span class="kpi-num mono">{{ stats.summary.visitors7d }}</span>
            <span class="kpi-sub mono">{{ t('account.stats.prevWeek', { count: stats.summary.visitorsPrev7d }) }}</span>
          </li>
          <li class="kpi">
            <span class="kpi-label mono">{{ t('account.stats.today') }}</span>
            <span class="kpi-num mono">{{ stats.summary.visitorsToday }}</span>
          </li>
          <li class="kpi">
            <span class="kpi-label mono">{{ t('account.stats.sessions') }}</span>
            <span class="kpi-num mono">{{ stats.summary.sessions7d }}</span>
          </li>
          <li class="kpi">
            <span class="kpi-label mono">{{ t('account.stats.signups') }}</span>
            <span class="kpi-num mono">{{ stats.summary.signups7d }}</span>
          </li>
          <li class="kpi kpi-muted">
            <span class="kpi-label mono">{{ t('account.stats.bots') }}</span>
            <span class="kpi-num mono">{{ stats.summary.bots7d }}</span>
          </li>
        </ul>
        <p class="conversion">{{ t('account.stats.conversion', { pct: conversionPct, total: stats.summary.usersTotal }) }}</p>

        <div class="daily">
          <h3 class="mini-title mono">{{ t('account.stats.daily') }}</h3>
          <div class="daily-plot" role="img" :aria-label="t('account.stats.daily')">
            <div
              v-for="b in dailyBars"
              :key="b.key"
              class="d-col"
              tabindex="0"
            >
              <span class="d-tip mono">{{ b.visitors }} · {{ dayLabel(b.date) }}</span>
              <span v-if="b.key === dailyPeak" class="d-peak mono">{{ b.visitors }}</span>
              <span class="d-bar" :class="{ empty: !b.visitors }" :style="{ height: b.visitors ? Math.max(4, (b.visitors / dailyMax) * 100) + '%' : '2px' }" />
              <span class="d-label mono">{{ b.date.getUTCDate() }}</span>
            </div>
          </div>
        </div>

        <div class="breakdowns">
          <div class="bd">
            <h3 class="mini-title mono">{{ t('account.stats.sources') }}</h3>
            <p v-if="!stats.sources.length" class="bd-empty">{{ t('account.stats.empty') }}</p>
            <ul v-else class="bd-list">
              <li v-for="r in stats.sources" :key="r.key">
                <span class="bd-name">{{ sourceLabel(r.key) }}</span>
                <span class="bd-num mono">{{ r.count }}</span>
                <span class="bd-bar"><span :style="{ width: share(stats.sources, r.count) + '%' }" /></span>
              </li>
            </ul>
          </div>
          <div class="bd">
            <h3 class="mini-title mono">{{ t('account.stats.countries') }}</h3>
            <p v-if="!stats.countries.length" class="bd-empty">{{ t('account.stats.empty') }}</p>
            <ul v-else class="bd-list">
              <li v-for="r in stats.countries" :key="r.key">
                <span class="bd-name"><span v-if="r.key" class="cc mono">{{ r.key }}</span>{{ countryLabel(r.key) }}</span>
                <span class="bd-num mono">{{ r.count }}</span>
                <span class="bd-bar"><span :style="{ width: share(stats.countries, r.count) + '%' }" /></span>
              </li>
            </ul>
          </div>
          <div class="bd">
            <h3 class="mini-title mono">{{ t('account.stats.devices') }}</h3>
            <p v-if="!stats.devices.length" class="bd-empty">{{ t('account.stats.empty') }}</p>
            <ul v-else class="bd-list">
              <li v-for="r in stats.devices" :key="r.key">
                <span class="bd-name"><AppIcon :name="r.key === 'mobile' ? 'phone' : 'monitor'" :size="14" />{{ deviceLabel(r.key) }}</span>
                <span class="bd-num mono">{{ share(stats.devices, r.count) }}%</span>
                <span class="bd-bar"><span :style="{ width: share(stats.devices, r.count) + '%' }" /></span>
              </li>
            </ul>
          </div>
        </div>

        <h3 class="mini-title mono log-title">{{ t('account.stats.log') }}</h3>
        <p v-if="!stats.visits.length" class="bd-empty">{{ t('account.visits.empty') }}</p>
        <ul v-else class="visit-log">
          <li v-for="v in stats.visits" :key="v.id" class="visit" :class="`k-${visitKind(v)}`">
            <span class="v-mark"><AppIcon v-if="v.isBot" name="bot" :size="13" /></span>
            <span class="v-main">
              <span class="v-name">{{ visitLabel(v) }}</span>
              <span v-if="visitMeta(v)" class="v-meta mono">{{ visitMeta(v) }}</span>
            </span>
            <span class="v-time mono">{{ formatVisitTime(v.createdAt) }}</span>
          </li>
        </ul>
      </template>
    </section>

    <section v-if="!infoLoading && info && !info.steamLinked" class="card password-card">
      <h2 class="card-title">{{ t('account.password.title') }}</h2>
      <form @submit.prevent="submitPasswordChange" class="auth-form">
        <label class="field-label">
          <span>{{ t('account.password.current') }}</span>
          <input v-model="currentPassword" type="password" class="input" required autocomplete="current-password" />
        </label>
        <label class="field-label">
          <span>{{ t('account.password.new') }}</span>
          <input v-model="newPassword" type="password" class="input" required minlength="6" autocomplete="new-password" />
        </label>
        <label class="field-label">
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
.account-view { padding-bottom: 20px; }
.account-header { padding: 12px 0 30px; }
.account-header h1 { margin-top: 18px; font-size: clamp(32px, 4.6vw, 56px); font-weight: 800; letter-spacing: -0.035em; }
.subtitle { color: var(--text-1); font-size: 16px; margin: 12px 0 0; }

.card {
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
  padding: 26px 28px;
  margin-bottom: 28px;
}
.card-title { font-size: 22px; font-weight: 800; }
.card-sub { color: var(--text-2); font-size: 14px; margin: 6px 0 20px; }
.field-label .input { font-family: var(--font-body); letter-spacing: 0; text-transform: none; }

.link-notice {
  font-size: 14px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  margin: 0 0 22px;
  border: 1.5px solid;
}
.link-notice.success { color: var(--st-completed); border-color: var(--st-completed); background: rgba(46, 230, 166, 0.08); }
.link-notice.error { color: var(--st-dropped); border-color: var(--st-dropped); background: rgba(255, 79, 94, 0.08); }

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 28px;
  align-items: start;
}

/* --- identity card --- */
.info-card { box-shadow: 8px 8px 0 var(--acid); border-color: var(--line-strong); }
.identity-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.account-avatar {
  width: 58px;
  height: 58px;
  border-radius: var(--radius-md);
  border: var(--stroke) solid var(--paper);
  object-fit: cover;
  flex-shrink: 0;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--acid);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
}
.identity-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.identity-name { font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.steam-badge {
  align-self: flex-start;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #66c0f4;
  border: 1.5px solid rgba(102, 192, 244, 0.45);
  padding: 3px 8px 2px;
  border-radius: 2px;
}
.spec { margin: 0; border-top: var(--stroke) solid var(--line-strong); }
.spec-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 11px 0;
  border-bottom: 1px dashed var(--line-strong);
}
.spec-row dt { color: var(--text-2); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; align-self: center; }
.spec-row dd { margin: 0; font-weight: 600; color: var(--text-0); overflow-wrap: anywhere; }

.btn-steam {
  background: #1b2838;
  border-color: #2a475e;
  color: #c7d5e0;
}
.btn-steam:hover { border-color: #66c0f4; box-shadow: 3px 3px 0 #66c0f4; color: #fff; }
.link-steam-btn { margin-top: 20px; }

/* --- shelf scoreboard --- */
.score {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.score-tile {
  --tone: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-left: 6px solid var(--tone);
  border-radius: var(--radius-md);
}
.score-tile.total { grid-column: 1 / -1; --tone: var(--acid); }
.score-tile.s-completed { --tone: var(--st-completed); }
.score-tile.s-planned { --tone: var(--st-planned); }
.score-tile.s-playing { --tone: var(--st-playing); }
.score-tile.s-dropped { --tone: var(--st-dropped); }
.score-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-1);
}
.score-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background: var(--tone);
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.score-num { font-size: 34px; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
.score-tile.total .score-num { font-size: 46px; }

/* --- admin stats --- */
.stats-card { border-color: var(--line-strong); }
.stats-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }

.kpis {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-md);
  background: var(--bg-0);
}
.kpi-main { background: var(--acid); border-color: var(--acid); color: var(--ink); }
.kpi-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-1); }
.kpi-main .kpi-label, .kpi-main .kpi-sub { color: var(--ink); }
.kpi-num { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
.kpi-sub { font-size: 11px; color: var(--text-2); }
.kpi-muted .kpi-num { color: var(--text-2); }
.conversion { margin: 14px 0 0; font-size: 14px; color: var(--text-1); }

.mini-title {
  margin: 0 0 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-1);
}

/* daily unique visitors, single series: one hue, bars anchored to the baseline */
.daily { margin-top: 26px; }
.daily-plot {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 150px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line-strong);
}
.d-col {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  outline: none;
}
.d-bar {
  width: 72%;
  max-width: 34px;
  background: var(--acid);
  border-radius: 4px 4px 0 0;
  transition: height var(--dur-slow) var(--ease-out), filter var(--dur-fast);
}
.d-bar.empty { background: var(--bg-3); border-radius: 1px; }
.d-col:hover .d-bar:not(.empty), .d-col:focus-visible .d-bar:not(.empty) { filter: brightness(1.15); }
.d-label {
  position: absolute;
  bottom: -20px;
  font-size: 10px;
  color: var(--text-2);
}
.d-peak {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-0);
  margin-bottom: 4px;
}
.d-tip {
  position: absolute;
  bottom: calc(100% - 18px);
  left: 50%;
  transform: translate(-50%, 4px);
  padding: 4px 7px;
  background: var(--paper);
  color: var(--ink);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  border-radius: 2px;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out);
  z-index: 2;
}
.d-col:hover .d-tip, .d-col:focus-visible .d-tip { opacity: 1; transform: translate(-50%, 0); }

.breakdowns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  margin-top: 30px;
}
.bd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.bd-list li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  font-size: 13px;
}
.bd-name { display: inline-flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-0); }
.bd-num { color: var(--text-1); font-size: 12px; font-weight: 700; }
.bd-bar { grid-column: 1 / -1; height: 4px; background: var(--bg-3); border-radius: 1px; overflow: hidden; }
.bd-bar span { display: block; height: 100%; background: var(--acid); }
.bd-empty { color: var(--text-2); font-size: 13px; margin: 0; }
.cc {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border: 1px solid var(--line-strong);
  border-radius: 2px;
  color: var(--text-1);
}

.log-title { margin-top: 30px; }
.visit-log {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 420px;
  overflow-y: auto;
  border-top: var(--stroke) solid var(--line);
}
.visit {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 2px;
  border-bottom: 1px solid var(--line);
}
.v-mark {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--text-2);
  color: var(--ink);
}
.k-user .v-mark { background: var(--st-completed); }
.k-new .v-mark { background: var(--st-planned); }
.k-returning .v-mark { background: var(--st-playing); }
.k-bot .v-mark { background: var(--bg-3); color: var(--text-2); }
.k-bot .v-name { color: var(--text-2); }
.v-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.v-name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-meta { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-time { font-size: 11px; color: var(--text-2); flex-shrink: 0; }

/* --- password --- */
.password-card { max-width: 480px; }
.auth-form { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
.submit-btn { width: 100%; min-height: 48px; margin-top: 4px; }
.error-msg { color: var(--st-dropped); font-size: 13px; margin: 0; }
.success-msg { color: var(--st-completed); font-size: 13px; margin: 0; }
.loading-msg { color: var(--text-2); letter-spacing: 0.06em; }

@media (max-width: 1000px) {
  .top-grid { grid-template-columns: 1fr; }
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi-main { grid-column: 1 / -1; }
  .breakdowns { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .card { padding: 20px 16px; }
  .info-card { box-shadow: 5px 5px 0 var(--acid); }
  .score-num { font-size: 28px; }
  .score-tile.total .score-num { font-size: 36px; }
  .d-label { font-size: 9px; }
  .v-time { display: none; }
}
</style>
