<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICON_NAMES } from '../stores/library'
import { useSteamPlaytimeStore } from '../stores/steamPlaytime'
import { useDealsStore } from '../stores/deals'
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../utils/push'
import { api } from '../utils/api'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'
import AppIcon from '../components/AppIcon.vue'

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
      <div class="title-block">
        <span class="tape">{{ t('nav.myGames') }}</span>
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
        <span class="stat-top">
          <span class="stat-label">{{ t(`status.${s}`) }}</span>
          <span class="stat-icon"><AppIcon :name="STATUS_ICON_NAMES[s]" :size="15" :stroke="2.75" /></span>
        </span>
        <span class="stat-num mono">{{ String(library.counts[s] || 0).padStart(2, '0') }}</span>
        <span class="stat-bar"><span :style="{ width: (library.items.length ? ((library.counts[s] || 0) / library.items.length) * 100 : 0) + '%' }" /></span>
      </button>
    </div>

    <div class="tools-row">
      <div v-if="library.items.length" class="search-wrap">
        <AppIcon name="search" :size="18" class="search-icon" />
        <input
          v-model="searchQuery"
          type="search"
          class="input search-input"
          :placeholder="t('myGames.searchPlaceholder')"
          :aria-label="t('myGames.searchPlaceholder')"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="searchQuery = ''"
          :aria-label="t('myGames.searchClear')"
        ><AppIcon name="x" :size="15" :stroke="2.5" /></button>
      </div>

      <button
        v-if="library.items.length"
        class="btn btn-outline random-btn"
        :disabled="!library.counts.planned"
        :title="library.counts.planned ? t('myGames.randomCta') : t('myGames.randomEmpty')"
        @click="pickRandom"
      >
        <AppIcon name="dice" :size="17" /> {{ t('myGames.randomCta') }}
      </button>

      <button
        v-if="library.items.length"
        class="btn btn-outline deals-btn"
        @click="openDealsModal"
      >
        <AppIcon name="bell" :size="17" /> {{ t('myGames.dealsCta') }}
      </button>

      <router-link v-if="library.items.length" :to="{ name: 'steam-import' }" class="btn btn-outline steam-btn">
        <AppIcon name="download" :size="17" /> {{ t('myGames.steamCta') }}
      </router-link>
    </div>

    <div v-if="library.loading && !library.loaded" class="loading-msg mono">{{ t('search.loading') }}</div>

    <div v-else-if="!library.items.length" class="empty-state">
      <div class="empty-shelf" aria-hidden="true">
        <span /><span /><span />
      </div>
      <p>{{ t('myGames.empty') }}</p>
      <div class="empty-actions">
        <router-link :to="{ name: 'library' }" class="btn btn-primary">{{ t('myGames.emptyCta') }}<AppIcon name="arrow-right" :size="16" /></router-link>
        <router-link :to="{ name: 'steam-import' }" class="btn btn-outline"><AppIcon name="download" :size="17" />{{ t('myGames.steamCta') }}</router-link>
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
      <div v-if="showRandom" class="overlay random-overlay" @click.self="closeRandom">
        <div class="dialog random-modal" role="dialog" aria-modal="true">
          <button class="icon-btn random-close" @click="closeRandom" :aria-label="t('myGames.randomClose')"><AppIcon name="x" :size="16" /></button>
          <p class="random-eyebrow"><span class="tape tape-hot">{{ t('myGames.randomEyebrow') }}</span></p>

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
            <button class="btn btn-outline" @click="pickRandom"><AppIcon name="dice" :size="17" /> {{ t('myGames.randomReroll') }}</button>
            <button class="btn btn-primary" @click="jumpToRandom">{{ t('myGames.randomJump') }}<AppIcon name="arrow-right" :size="16" /></button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade-slide">
      <div v-if="showDealsModal" class="overlay random-overlay" @click.self="showDealsModal = false">
        <div class="dialog deals-modal" role="dialog" aria-modal="true">
          <button class="icon-btn random-close" @click="showDealsModal = false" :aria-label="t('myGames.dealsClose')"><AppIcon name="x" :size="16" /></button>
          <p class="random-eyebrow"><span class="tape tape-hot"><AppIcon name="bell" :size="13" :stroke="2.5" />{{ t('myGames.dealsEyebrow') }}</span></p>

          <div class="deals-default">
            <label class="deals-default-label">
              <span>{{ t('account.deals.label') }}</span>
              <div class="deals-input-wrap">
                <input v-model.number="defaultThreshold" type="number" min="1" max="90" class="deals-input" />
                <span class="deals-percent">%</span>
              </div>
            </label>
            <button class="btn btn-primary deals-default-save" :disabled="defaultThresholdSaving" @click="saveDefaultThreshold">
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
              class="btn btn-outline push-btn"
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
            <button class="btn btn-outline deals-test-btn" :disabled="testSending" @click="sendTestNotification">
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
.my-view { padding-bottom: 40px; }
.my-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px 24px;
  padding: 12px 0 28px;
}
.title-block h1 {
  margin-top: 18px;
  font-size: clamp(32px, 4.6vw, 56px);
  font-weight: 800;
  letter-spacing: -0.035em;
}
.stat { color: var(--text-2); font-size: 12px; margin: 10px 0 0; letter-spacing: 0.06em; text-transform: uppercase; }

/* --- scoreboard: one block per shelf --- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}
.stat-card {
  --tone: var(--acid);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
  border-radius: var(--radius-lg);
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  color: var(--text-0);
  text-align: left;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast), background var(--dur-fast);
}
.stat-card.s-completed { --tone: var(--st-completed); }
.stat-card.s-planned { --tone: var(--st-planned); }
.stat-card.s-playing { --tone: var(--st-playing); }
.stat-card.s-dropped { --tone: var(--st-dropped); }
.stat-card:hover {
  transform: translate(-3px, -3px);
  border-color: var(--tone);
  box-shadow: 5px 5px 0 var(--tone);
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.stat-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-1);
}
.stat-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tone);
  color: var(--ink);
  flex-shrink: 0;
}
.stat-num {
  font-size: clamp(30px, 3.6vw, 44px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--text-0);
}
.stat-bar {
  display: block;
  height: 6px;
  background: var(--bg-3);
  border-radius: 1px;
  overflow: hidden;
}
.stat-bar span {
  display: block;
  height: 100%;
  background: var(--tone);
  transition: width var(--dur-slow) var(--ease-out);
}
.stat-card.active {
  background: var(--tone);
  border-color: var(--tone);
}
.stat-card.active .stat-label,
.stat-card.active .stat-num { color: var(--ink); }
.stat-card.active .stat-icon { background: var(--ink); color: var(--tone); }
.stat-card.active .stat-bar { background: rgba(0, 0, 0, 0.2); }
.stat-card.active .stat-bar span { background: var(--ink); }

/* --- tools --- */
.tools-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 28px;
  padding: 12px;
  border: var(--stroke) dashed var(--line-strong);
  border-radius: var(--radius-lg);
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
  pointer-events: none;
}
.search-wrap:focus-within .search-icon { color: var(--acid); }
.search-input {
  padding-left: 42px;
  padding-right: 44px;
  -webkit-appearance: none;
  appearance: none;
}
.search-input::-webkit-search-cancel-button { display: none; }
.search-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-2);
  transition: background var(--dur-fast), color var(--dur-fast);
}
.search-clear:hover { background: var(--bg-3); color: var(--text-0); }

.random-btn, .deals-btn, .steam-btn { flex-shrink: 0; }

/* --- dialogs --- */
.random-overlay { z-index: 100; }
.random-modal {
  max-width: 400px;
  padding: 26px 24px 24px;
  text-align: center;
}
.deals-modal {
  max-width: 480px;
  max-height: 86vh;
  padding: 26px 24px 22px;
  display: flex;
  flex-direction: column;
  text-align: left;
}
.random-close {
  position: absolute;
  top: 14px;
  right: 14px;
}
.random-eyebrow { margin: 0 0 22px; }
.random-eyebrow .tape :deep(svg) { margin-right: 2px; }

.random-body { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.random-cover {
  width: 150px;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-2);
  border: var(--stroke) solid var(--paper);
  box-shadow: 6px 6px 0 var(--st-planned);
  transform: rotate(-2deg);
  animation: random-drop 0.55s var(--ease-spring);
}
@keyframes random-drop {
  from { transform: translateY(-18px) rotate(-8deg); opacity: 0; }
  to { transform: rotate(-2deg); opacity: 1; }
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
.random-info h3 { font-family: var(--font-display); font-size: 21px; letter-spacing: -0.02em; margin: 4px 0 6px; }
.random-genre { font-family: var(--font-mono); font-size: 12px; color: var(--text-2); margin: 0; }

.random-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
}

.deals-default {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.deals-default-label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-1);
  flex: 1;
}
.deals-default-save { flex-shrink: 0; }
.push-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed var(--line-strong);
}
.push-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.push-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.push-desc { font-size: 13px; color: var(--text-2); }
.push-btn { flex-shrink: 0; }
.push-denied { font-size: 12px; color: var(--text-2); flex-shrink: 0; max-width: 160px; }
.deals-test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.deals-test-btn { flex-shrink: 0; }
.test-result { font-size: 13px; margin: 0; }
.test-result.ok { color: var(--st-completed); }
.test-result.fail { color: var(--st-dropped); }
.error-msg { color: var(--st-dropped); font-size: 13px; margin: 8px 0 0; }
.success-msg { color: var(--st-completed); font-size: 13px; margin: 8px 0 0; }
.deals-hint {
  font-size: 13px;
  color: var(--text-2);
  margin: 0 0 18px;
}
.deals-hint-list { margin-top: 20px; padding-top: 18px; border-top: 1px dashed var(--line-strong); margin-bottom: 10px; }
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
  border-top: var(--stroke) solid var(--line);
}
.deals-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--line);
}
.deals-row-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.deals-row.muted .deals-title { color: var(--text-2); text-decoration: line-through; text-decoration-color: var(--line-strong); }
.deals-cover {
  flex-shrink: 0;
  width: 34px;
  height: 44px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-2);
  border: 1.5px solid var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}
.deals-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.deals-row.muted .deals-cover { opacity: 0.45; filter: grayscale(1); }
.deals-cover-fallback { font-size: 11px; font-weight: 700; color: var(--text-2); }
.deals-title {
  font-size: 14px;
  font-weight: 700;
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
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid var(--line-strong);
  background: var(--bg-0);
  transition: border-color var(--dur-fast);
}
.deals-input-wrap:focus-within { border-color: var(--acid); }
.deals-input-wrap-lg { height: 46px; }
.deals-input {
  width: 44px;
  border: none;
  background: transparent;
  color: var(--text-0);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  text-align: right;
  -moz-appearance: textfield;
}
.deals-input-wrap-lg .deals-input { width: 100%; text-align: left; font-size: 16px; }
.deals-input::-webkit-outer-spin-button,
.deals-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.deals-input:disabled { color: var(--text-2); }
.deals-input:focus { outline: none; }
.deals-percent { font-family: var(--font-mono); font-size: 13px; color: var(--text-2); }
.deals-save-btn,
.deals-mute-btn {
  flex-shrink: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast), opacity var(--dur-fast);
}
.deals-save-btn {
  border: var(--stroke) solid var(--acid);
  color: var(--acid);
}
.deals-save-btn:hover:not(:disabled) { background: var(--acid); color: var(--ink); }
.deals-save-btn:disabled { opacity: 0.45; }
.deals-save-btn.saved {
  border-color: var(--st-completed);
  color: var(--st-completed);
}
.deals-mute-btn {
  border: var(--stroke) solid var(--line-strong);
  color: var(--text-1);
}
.deals-mute-btn:hover { border-color: var(--paper); color: var(--text-0); }
.deals-mute-btn.active {
  color: var(--ink);
  border-color: var(--st-dropped);
  background: var(--st-dropped);
}

.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity var(--dur-fast) var(--ease-out);
}
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: none; }
.fade-slide-enter-active .dialog, .fade-slide-leave-active .dialog {
  transition: transform var(--dur-med) var(--ease-spring);
}
.fade-slide-enter-from .dialog { transform: translateY(16px) rotate(-1deg) scale(0.97); }
.fade-slide-leave-to .dialog { transform: translateY(8px) scale(0.98); }

/* --- empty --- */
.empty-state {
  text-align: center;
  padding: 64px 20px 72px;
  color: var(--text-1);
  font-size: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  border: var(--stroke) dashed var(--line-strong);
  border-radius: var(--radius-lg);
}
.empty-state p { margin: 0; max-width: 420px; }
.empty-shelf {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 70px;
  padding: 0 14px;
  border-bottom: 3px solid var(--paper);
}
.empty-shelf span {
  width: 18px;
  border: var(--stroke) dashed var(--line-strong);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
}
.empty-shelf span:nth-child(1) { height: 70%; }
.empty-shelf span:nth-child(2) { height: 100%; }
.empty-shelf span:nth-child(3) { height: 82%; transform: rotate(10deg); transform-origin: bottom left; }
.empty-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.loading-msg { color: var(--text-2); text-align: center; padding: 60px 0; letter-spacing: 0.06em; }

.game-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 22px;
}

@media (max-width: 900px) {
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .game-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
}

@media (max-width: 560px) {
  .stat-row { gap: 10px; }
  .stat-card { padding: 12px 12px 14px; }
  .tools-row { padding: 10px; }
  .tools-row .btn { flex: 1 1 auto; }
  .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .push-row { flex-direction: column; align-items: flex-start; }
  .deals-controls { padding-left: 0; }
}
</style>
