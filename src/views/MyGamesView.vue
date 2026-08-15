<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICONS } from '../stores/library'
import { useSteamPlaytimeStore } from '../stores/steamPlaytime'
import { useDealsStore } from '../stores/deals'
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../utils/push'
import { api } from '../utils/api'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()
const steamPlaytime = useSteamPlaytimeStore()
const deals = useDealsStore()
const activeTab = ref('all')
const searchQuery = ref('')

const filtered = computed(() => {
  let list = activeTab.value === 'all' ? library.items : library.byStatus(activeTab.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter((i) => i.title.toLowerCase().includes(q))
  return list
})

function toCardGame(item) {
  let genres = null
  try {
    genres = item.genres ? JSON.parse(item.genres) : null
  } catch {
    genres = null
  }
  return {
    id: item.game_id,
    title: item.title,
    cover: item.cover,
    genres,
    released: item.released || null,
    rating: item.catalog_rating ?? null,
    playtimeMinutes: steamPlaytime.playtimeFor(item.game_id, item.title)
  }
}

// --- random pick from "planned" ---
const randomPick = ref(null)
const showRandom = ref(false)
const highlightId = ref(null)
let highlightTimer = null

function pickRandom() {
  const planned = library.byStatus('planned')
  if (!planned.length) return
  const item = planned[Math.floor(Math.random() * planned.length)]
  randomPick.value = toCardGame(item)
  showRandom.value = true
}

function closeRandom() {
  showRandom.value = false
}

async function jumpToRandom() {
  if (!randomPick.value) return
  const id = randomPick.value.id
  activeTab.value = 'planned'
  searchQuery.value = ''
  showRandom.value = false
  await nextTick()
  const el = document.getElementById(`game-card-${id}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightId.value = id
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlightId.value = null }, 1800)
}

// --- per-game deal-drop notification settings ---
const showDealsModal = ref(false)
const dealDrafts = ref({}) // gameId -> string value of the custom-% input
const dealSavingId = ref(null) // game_id currently being saved
const dealSavedId = ref(null) // game_id that was just saved (briefly shows a checkmark)

const plannedForDeals = computed(() => library.byStatus('planned'))

// account-wide default threshold
const defaultThreshold = ref(20)
const defaultThresholdSaving = ref(false)
const defaultThresholdError = ref(null)
const defaultThresholdSaved = ref(false)

// push subscription state
const pushStatus = ref('unsubscribed') // unsubscribed | subscribed | denied | unsupported
const pushBusy = ref(false)
const pushError = ref(null)

// test notification
const testSending = ref(false)
const testResult = ref(null) // { ok: bool, message: string } | null

function openDealsModal() {
  const drafts = {}
  for (const item of plannedForDeals.value) {
    drafts[item.game_id] =
      item.deal_threshold_percent != null && item.deal_threshold_percent !== 0
        ? String(item.deal_threshold_percent)
        : ''
  }
  dealDrafts.value = drafts
  defaultThreshold.value = deals.threshold
  defaultThresholdSaved.value = false
  defaultThresholdError.value = null
  testResult.value = null
  showDealsModal.value = true
}

function isMuted(item) {
  return item.deal_threshold_percent === 0
}

async function toggleMute(item) {
  dealSavedId.value = null
  if (isMuted(item)) {
    await library.setDealThreshold(item.game_id, null)
    dealDrafts.value[item.game_id] = ''
  } else {
    await library.setDealThreshold(item.game_id, 0)
  }
}

async function saveCustom(item) {
  const raw = dealDrafts.value[item.game_id]
  if (raw === '' || raw == null) {
    if (item.deal_threshold_percent != null) await library.setDealThreshold(item.game_id, null)
    return
  }
  const val = parseInt(raw, 10)
  if (!Number.isFinite(val) || val < 1 || val > 90) {
    dealDrafts.value[item.game_id] = item.deal_threshold_percent ? String(item.deal_threshold_percent) : ''
    return
  }
  if (val === item.deal_threshold_percent) return
  dealSavingId.value = item.game_id
  try {
    await library.setDealThreshold(item.game_id, val)
    dealSavedId.value = item.game_id
    setTimeout(() => {
      if (dealSavedId.value === item.game_id) dealSavedId.value = null
    }, 1500)
  } finally {
    dealSavingId.value = null
  }
}

async function saveDefaultThreshold() {
  defaultThresholdError.value = null
  defaultThresholdSaved.value = false
  if (!Number.isFinite(defaultThreshold.value) || defaultThreshold.value < 1 || defaultThreshold.value > 90) {
    defaultThresholdError.value = t('account.deals.invalid')
    return
  }
  defaultThresholdSaving.value = true
  try {
    await api.post('/account-deal-threshold', { percent: defaultThreshold.value }, auth.token)
    defaultThresholdSaved.value = true
    deals.reset()
    deals.ensureChecked()
  } catch (e) {
    defaultThresholdError.value = e.message
  } finally {
    defaultThresholdSaving.value = false
  }
}

async function enablePush() {
  pushError.value = null
  pushBusy.value = true
  try {
    await subscribeToPush(auth.token)
    pushStatus.value = 'subscribed'
  } catch (e) {
    pushStatus.value = e.message === 'permission-denied' ? 'denied' : await getPushStatus()
    pushError.value = e.message === 'permission-denied' ? t('account.deals.pushDenied') : e.message
  } finally {
    pushBusy.value = false
  }
}

async function disablePush() {
  pushBusy.value = true
  try {
    await unsubscribeFromPush(auth.token)
    pushStatus.value = 'unsubscribed'
  } finally {
    pushBusy.value = false
  }
}

async function sendTestNotification() {
  testResult.value = null
  testSending.value = true
  try {
    await api.post('/push-test', {}, auth.token)
    testResult.value = { ok: true, message: t('myGames.dealsTestSuccess') }
  } catch (e) {
    testResult.value = { ok: false, message: e.message === 'no-subscription' ? t('myGames.dealsTestNoSub') : t('myGames.dealsTestFail') }
  } finally {
    testSending.value = false
  }
}

onMounted(() => {
  steamPlaytime.ensureLoaded()
  deals.ensureChecked()
  getPushStatus().then((s) => { pushStatus.value = s })
  ;(async () => {
    if (!library.loaded) await library.fetchAll()
    library.backfillMeta()
  })()
})
</script>

<template>
  <div class="shell my-view">
    <header class="my-header">
      <div>
        <h1>{{ t('myGames.title') }}</h1>
        <p class="stat mono" v-if="library.items.length">{{ t('myGames.stat', { count: library.items.length }) }}</p>
      </div>
      <CategoryTabs v-model="activeTab" :counts="library.counts" />
    </header>

    <div v-if="library.items.length" class="stat-row">
      <button
        v-for="s in STATUSES"
        :key="s"
        class="stat-card"
        :class="[`s-${s}`, { active: activeTab === s }]"
        @click="activeTab = s"
      >
        <span class="stat-icon mono">{{ STATUS_ICONS[s] }}</span>
        <span class="stat-text">
          <span class="stat-num mono">{{ library.counts[s] || 0 }}</span>
          <span class="stat-label">{{ t(`status.${s}`) }}</span>
        </span>
      </button>
    </div>

    <div class="tools-row">
      <div v-if="library.items.length" class="search-wrap">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('myGames.searchPlaceholder')"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="searchQuery = ''"
          :aria-label="t('myGames.searchClear')"
        >✕</button>
      </div>

      <button
        v-if="library.items.length"
        class="btn btn-ghost random-btn"
        :disabled="!library.counts.planned"
        :title="library.counts.planned ? t('myGames.randomCta') : t('myGames.randomEmpty')"
        @click="pickRandom"
      >
        <span aria-hidden="true">🎲</span> {{ t('myGames.randomCta') }}
      </button>

      <button
        v-if="library.items.length"
        class="btn btn-ghost deals-btn"
        @click="openDealsModal"
      >
        <span aria-hidden="true">🔔</span> {{ t('myGames.dealsCta') }}
      </button>

      <router-link :to="{ name: 'steam-import' }" class="btn btn-ghost steam-btn" :class="{ 'steam-btn-alone': !library.items.length }">
        <span aria-hidden="true">⇩</span> {{ t('myGames.steamCta') }}
      </router-link>
    </div>

    <div v-if="library.loading && !library.loaded" class="loading-msg mono">{{ t('search.loading') }}</div>

    <div v-else-if="!library.items.length" class="empty-state">
      <p>{{ t('myGames.empty') }}</p>
      <div class="empty-actions">
        <router-link :to="{ name: 'library' }" class="btn btn-primary">{{ t('myGames.emptyCta') }}</router-link>
      </div>
    </div>

    <div v-else-if="!filtered.length" class="empty-state">
      <p>{{ t('myGames.noResults') }}</p>
    </div>

    <div v-else class="game-grid">
      <GameCard
        v-for="item in filtered"
        :key="item.game_id"
        :id="`game-card-${item.game_id}`"
        :class="{ 'is-highlighted': highlightId === item.game_id }"
        :game="toCardGame(item)"
        :status="item.status"
        :user-rating="item.rating"
        :show-rating="true"
        @set-status="(s) => library.upsert(toCardGame(item), s)"
        @set-rating="(r) => library.rate(item.game_id, r)"
        @remove="library.remove(item.game_id)"
      />
    </div>

    <transition name="fade-slide">
      <div v-if="showRandom" class="random-overlay" @click.self="closeRandom">
        <div class="random-modal card-surface">
          <button class="random-close" @click="closeRandom" :aria-label="t('myGames.randomClose')">✕</button>
          <p class="random-eyebrow mono">{{ t('myGames.randomEyebrow') }}</p>

          <div class="random-body">
            <div class="random-cover">
              <img v-if="randomPick.cover" :src="randomPick.cover" :alt="randomPick.title" />
              <div v-else class="random-cover-fallback mono">{{ randomPick.title.slice(0, 2).toUpperCase() }}</div>
            </div>
            <div class="random-info">
              <h3>{{ randomPick.title }}</h3>
              <p v-if="randomPick.genres?.length" class="random-genre">{{ randomPick.genres.slice(0, 2).join(' · ') }}</p>
            </div>
          </div>

          <div class="random-actions">
            <button class="btn btn-ghost" @click="pickRandom">🎲 {{ t('myGames.randomReroll') }}</button>
            <button class="btn btn-primary" @click="jumpToRandom">{{ t('myGames.randomJump') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade-slide">
      <div v-if="showDealsModal" class="random-overlay" @click.self="showDealsModal = false">
        <div class="deals-modal card-surface">
          <button class="random-close" @click="showDealsModal = false" :aria-label="t('myGames.dealsClose')">✕</button>
          <p class="random-eyebrow mono">{{ t('myGames.dealsEyebrow') }}</p>

          <div class="deals-default">
            <label class="deals-default-label">
              <span>{{ t('account.deals.label') }}</span>
              <div class="deals-input-wrap">
                <input v-model.number="defaultThreshold" type="number" min="1" max="90" class="deals-input" />
                <span class="deals-percent">%</span>
              </div>
            </label>
            <button class="btn btn-ghost deals-default-save" :disabled="defaultThresholdSaving" @click="saveDefaultThreshold">
              {{ t('account.deals.submit') }}
            </button>
          </div>
          <p v-if="defaultThresholdSaved" class="success-msg">{{ t('account.deals.success') }}</p>
          <p v-if="defaultThresholdError" class="error-msg">{{ defaultThresholdError }}</p>

          <div class="push-row">
            <div class="push-text">
              <span class="push-title">{{ t('account.deals.pushTitle') }}</span>
              <span class="push-desc">{{ t('account.deals.pushDesc') }}</span>
            </div>
            <button
              v-if="pushStatus === 'subscribed'"
              type="button"
              class="btn btn-ghost push-btn"
              :disabled="pushBusy"
              @click="disablePush"
            >{{ t('account.deals.pushDisable') }}</button>
            <button
              v-else-if="pushStatus === 'unsubscribed'"
              type="button"
              class="btn btn-primary push-btn"
              :disabled="pushBusy"
              @click="enablePush"
            >{{ t('account.deals.pushEnable') }}</button>
            <span v-else-if="pushStatus === 'denied'" class="push-denied">{{ t('account.deals.pushDenied') }}</span>
            <span v-else class="push-denied">{{ t('account.deals.pushUnsupported') }}</span>
          </div>
          <p v-if="pushError" class="error-msg">{{ pushError }}</p>

          <div v-if="pushStatus === 'subscribed'" class="deals-test-row">
            <button class="btn btn-ghost deals-test-btn" :disabled="testSending" @click="sendTestNotification">
              {{ testSending ? t('myGames.dealsTestSending') : t('myGames.dealsTestCta') }}
            </button>
            <p v-if="testResult" class="test-result" :class="{ ok: testResult.ok, fail: !testResult.ok }">{{ testResult.message }}</p>
          </div>

          <p class="deals-hint deals-hint-list">{{ t('myGames.dealsHint', { threshold: deals.threshold }) }}</p>

          <p v-if="!plannedForDeals.length" class="deals-empty">{{ t('myGames.dealsEmpty') }}</p>

          <ul v-else class="deals-list">
            <li
              v-for="item in plannedForDeals"
              :key="item.game_id"
              class="deals-row"
              :class="{ muted: isMuted(item) }"
            >
              <div class="deals-row-top">
                <div class="deals-cover">
                  <img v-if="item.cover" :src="item.cover" :alt="item.title" loading="lazy" />
                  <span v-else class="deals-cover-fallback mono">{{ item.title.slice(0, 2).toUpperCase() }}</span>
                </div>
                <span class="deals-title">{{ item.title }}</span>
              </div>
              <div class="deals-controls">
                <div class="deals-input-wrap">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    class="deals-input"
                    :placeholder="String(deals.threshold)"
                    :disabled="isMuted(item)"
                    v-model="dealDrafts[item.game_id]"
                    @keyup.enter="saveCustom(item); $event.target.blur()"
                  />
                  <span class="deals-percent">%</span>
                </div>
                <button
                  type="button"
                  class="deals-save-btn"
                  :class="{ saved: dealSavedId === item.game_id }"
                  :disabled="isMuted(item) || dealSavingId === item.game_id"
                  @click="saveCustom(item)"
                >{{ dealSavingId === item.game_id ? t('myGames.dealsSaving') : (dealSavedId === item.game_id ? t('myGames.dealsSaved') : t('myGames.dealsSave')) }}</button>
                <button
                  type="button"
                  class="deals-mute-btn"
                  :class="{ active: isMuted(item) }"
                  @click="toggleMute(item)"
                >{{ isMuted(item) ? t('myGames.dealsUnmute') : t('myGames.dealsMute') }}</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.my-view { padding-bottom: 60px; }
.my-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px 0 28px;
}
.my-header h1 { font-size: clamp(26px, 4vw, 36px); }
.stat { color: var(--text-2); font-size: 12px; margin-top: 6px; }

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 30px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  text-align: left;
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast), background var(--dur-fast);
}
.stat-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }

.stat-icon {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #fdfaf2;
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.5);
}
.stat-card.s-completed .stat-icon { background: var(--card-completed); }
.stat-card.s-planned .stat-icon { background: var(--card-planned); }
.stat-card.s-playing .stat-icon { background: var(--card-playing); }
.stat-card.s-dropped .stat-icon { background: var(--card-dropped); }

.stat-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stat-num { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--text-0); }
.stat-label { font-size: 12px; color: var(--text-2); }

.stat-card.active { background: var(--bg-2); }
.stat-card.active.s-completed { border-color: var(--card-completed); }
.stat-card.active.s-planned { border-color: var(--card-planned); }
.stat-card.active.s-playing { border-color: var(--card-playing); }
.stat-card.active.s-dropped { border-color: var(--card-dropped); }

.tools-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.search-wrap {
  position: relative;
  flex: 1 1 260px;
  min-width: 200px;
}
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-2);
  font-size: 15px;
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 11px 38px 11px 38px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  color: var(--text-0);
  font-size: 14px;
  font-family: inherit;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.search-input::placeholder { color: var(--text-2); }
.search-input:focus {
  outline: none;
  border-color: var(--accent-amber);
  background: var(--bg-2);
}
.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.search-clear:hover { background: var(--bg-2); color: var(--text-0); }

.random-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.random-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.random-btn:disabled:hover { transform: none; }

.steam-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  text-decoration: none;
}
.steam-btn-alone { margin: 0 auto; }

.deals-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.deals-modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 84vh;
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  text-align: left;
}
.deals-default {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.deals-default-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-1);
  font-weight: 600;
  flex: 1;
}
.deals-default-save { flex-shrink: 0; white-space: nowrap; }
.push-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border-soft);
}
.push-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.push-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
.push-desc { font-size: 12px; color: var(--text-2); }
.push-btn { flex-shrink: 0; white-space: nowrap; }
.push-denied { font-size: 12px; color: var(--text-2); flex-shrink: 0; }
.deals-test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.deals-test-btn { flex-shrink: 0; white-space: nowrap; }
.test-result { font-size: 12px; margin: 0; }
.test-result.ok { color: var(--status-completed); }
.test-result.fail { color: var(--status-dropped); }
.error-msg { color: var(--status-dropped); font-size: 13px; margin: 6px 0 0; }
.success-msg { color: var(--status-completed); font-size: 13px; margin: 6px 0 0; }
.deals-hint {
  font-size: 13px;
  color: var(--text-2);
  margin: 0 0 18px;
  text-align: left;
}
.deals-hint-list { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-soft); margin-bottom: 12px; }
.deals-empty {
  color: var(--text-2);
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}
.deals-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid var(--border-soft);
}
.deals-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--border-soft);
  text-align: left;
}
.deals-row-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.deals-row.muted .deals-title { color: var(--text-2); }
.deals-cover {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.deals-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.deals-row.muted .deals-cover { opacity: 0.5; }
.deals-cover-fallback { font-size: 11px; font-weight: 700; color: var(--text-2); }
.deals-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.deals-controls {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 46px;
  flex-wrap: wrap;
}
.deals-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
}
.deals-input {
  width: 40px;
  border: none;
  background: transparent;
  color: var(--text-0);
  font-size: 13px;
  font-family: inherit;
  text-align: right;
  -moz-appearance: textfield;
}
.deals-input::-webkit-outer-spin-button,
.deals-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.deals-input:disabled { color: var(--text-2); }
.deals-input:focus { outline: none; }
.deals-percent { font-size: 12px; color: var(--text-2); }
.deals-save-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-amber);
  background: transparent;
  color: var(--accent-amber);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast), opacity var(--dur-fast);
}
.deals-save-btn:hover:not(:disabled) { background: var(--accent-amber); color: #17131a; }
.deals-save-btn:disabled { opacity: 0.5; cursor: default; }
.deals-save-btn.saved {
  border-color: var(--status-completed);
  color: var(--status-completed);
}
.deals-mute-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
}
.deals-mute-btn:hover { background: var(--bg-1); color: var(--text-0); }
.deals-mute-btn.active {
  color: var(--status-dropped);
  border-color: var(--status-dropped);
  background: rgba(var(--status-dropped-rgb, 220, 90, 90), 0.1);
}

.random-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(10, 12, 16, 0.72);
  backdrop-filter: blur(6px);
}
.random-modal {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 28px 24px 24px;
  text-align: center;
}
.random-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}
.random-close:hover { color: var(--text-0); border-color: var(--border-strong); }

.random-eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-amber);
  margin: 0 0 18px;
}

.random-body { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.random-cover {
  width: 140px;
  height: 186px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
}
.random-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.random-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-2);
}
.random-info h3 { font-size: 19px; margin: 0 0 4px; }
.random-genre { font-size: 13px; color: var(--text-2); margin: 0; }

.random-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 22px;
}

.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity var(--dur-fast) var(--ease-out);
}
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; }
.fade-slide-enter-active .random-modal, .fade-slide-leave-active .random-modal {
  transition: transform var(--dur-med) var(--ease-out);
}
.fade-slide-enter-from .random-modal { transform: translateY(12px) scale(0.97); }
.fade-slide-leave-to .random-modal { transform: translateY(8px) scale(0.98); }

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.empty-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.loading-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.game-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 20px;
}

@media (max-width: 900px) {
  .game-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
}

@media (max-width: 560px) {
  .game-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
</style>
