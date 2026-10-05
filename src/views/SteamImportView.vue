<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICONS } from '../stores/library'
import { api } from '../utils/api'
import AppIcon from '../components/AppIcon.vue'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()

// linked accounts (signed in via Steam) skip the manual profile step entirely
const isSteamLinked = ref(false)
const checkingAccount = ref(true)

// step 1 — profile lookup
const steamInput = ref('')
const fetching = ref(false)
const fetchError = ref(null)
const games = ref(null) // null = not fetched yet

// step 2 — selection
const searchQuery = ref('')
const selected = ref(new Set())
const importStatus = ref('planned')

// step 3 — import. The server takes at most 60 games per request (each one
// is matched against the catalog), so the selection goes up in batches.
const IMPORT_BATCH = 20
const importProgress = ref({ done: 0, total: 0 })
const importing = ref(false)
const importError = ref(null)
const importResult = ref(null)

async function fetchLibrary() {
  fetching.value = true
  fetchError.value = null
  games.value = null
  try {
    const res = await api.get('/steam-library', auth.token, steamInput.value.trim() ? { steamid: steamInput.value.trim() } : {})
    if (res.privacyBlocked || !res.games?.length) {
      fetchError.value = t('steamImport.privacyError')
      games.value = []
      return
    }
    games.value = res.games
    selected.value = new Set()
  } catch (e) {
    fetchError.value = /not-found/i.test(e.message) ? t('steamImport.notFoundError') : t('steamImport.genericError')
    games.value = []
  } finally {
    fetching.value = false
  }
}

onMounted(async () => {
  try {
    const info = await api.get('/account-info', auth.token)
    isSteamLinked.value = !!info.steamLinked
  } catch {
    isSteamLinked.value = false
  } finally {
    checkingAccount.value = false
  }
  if (isSteamLinked.value) fetchLibrary()
})

const phase = computed(() => {
  if (checkingAccount.value) return 'checking'
  if (importResult.value) return 'done'
  if (fetching.value) return 'loading'
  if (fetchError.value) return 'error'
  if (games.value?.length) return 'picker'
  return isSteamLinked.value ? 'loading' : 'input'
})

const filteredGames = computed(() => {
  if (!games.value) return []
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return games.value
  return games.value.filter((g) => g.title.toLowerCase().includes(q))
})

function toggle(appid) {
  const next = new Set(selected.value)
  if (next.has(appid)) next.delete(appid)
  else next.add(appid)
  selected.value = next
}

function selectAllVisible() {
  const next = new Set(selected.value)
  for (const g of filteredGames.value) next.add(g.appid)
  selected.value = next
}

function selectNoneVisible() {
  const next = new Set(selected.value)
  for (const g of filteredGames.value) next.delete(g.appid)
  selected.value = next
}

function hoursLabel(minutes) {
  if (!minutes) return t('steamImport.notPlayed')
  const hours = Math.round((minutes / 60) * 10) / 10
  return t('steamImport.hoursPlayed', { hours })
}

async function runImport() {
  const picked = games.value.filter((g) => selected.value.has(g.appid)).map((g) => ({ appid: g.appid, title: g.title, playtimeMinutes: g.playtimeMinutes }))
  if (!picked.length) return
  importing.value = true
  importError.value = null
  importProgress.value = { done: 0, total: picked.length }
  let added = 0
  let matched = 0
  try {
    for (let i = 0; i < picked.length; i += IMPORT_BATCH) {
      const res = await api.post('/steam-import', { status: importStatus.value, games: picked.slice(i, i + IMPORT_BATCH) }, auth.token)
      added += res.added || 0
      matched += res.matched || 0
      importProgress.value = { done: Math.min(i + IMPORT_BATCH, picked.length), total: picked.length }
    }
    importResult.value = { added, matched }
    await library.fetchAll()
  } catch (e) {
    importError.value = e.message || t('steamImport.genericError')
    // whatever made it in before the failure should still show up
    if (added) library.fetchAll()
  } finally {
    importing.value = false
  }
}

function startOver() {
  games.value = null
  steamInput.value = ''
  selected.value = new Set()
  importResult.value = null
  importError.value = null
  fetchError.value = null
}
</script>

<template>
  <div class="shell steam-view">
    <router-link :to="{ name: 'my-games' }" class="back-link"><AppIcon name="arrow-left" :size="16" :stroke="2.5" />{{ t('steamImport.back') }}</router-link>

    <header class="steam-header">
      <span class="tape"><AppIcon name="download" :size="13" :stroke="2.5" />Steam</span>
      <h1>{{ t('steamImport.title') }}</h1>
      <p class="subtitle">{{ t('steamImport.subtitle') }}</p>
    </header>

    <!-- step 1: find the profile (only for accounts not signed in via Steam) -->
    <section v-if="phase === 'checking' || phase === 'loading'" class="loading-block mono">
      {{ t('steamImport.fetching') }}
    </section>

    <section v-else-if="phase === 'input'" class="lookup-card">
      <form @submit.prevent="fetchLibrary" class="lookup-form">
        <label class="field-label">
          <span>{{ t('steamImport.inputLabel') }}</span>
          <input
            v-model="steamInput"
            type="text"
            class="input"
            :placeholder="t('steamImport.inputPlaceholder')"
            autocomplete="off"
          />
          <span class="input-hint">{{ t('steamImport.inputHint') }}</span>
        </label>
        <button class="btn btn-primary submit-btn" type="submit" :disabled="!steamInput.trim()">
          {{ t('steamImport.fetchCta') }}
        </button>
      </form>
    </section>

    <section v-else-if="phase === 'error'" class="lookup-card">
      <p class="error-msg">{{ fetchError }}</p>
      <button class="btn btn-primary submit-btn" type="button" @click="fetchLibrary">
        {{ t('steamImport.fetchCta') }}
      </button>
      <button v-if="!isSteamLinked" class="btn btn-ghost submit-btn" type="button" @click="startOver">
        {{ t('steamImport.tryAnother') }}
      </button>
    </section>

    <!-- step 2: pick games -->
    <section v-else-if="phase === 'picker'" class="picker">
      <div class="picker-toolbar">
        <p class="found-count mono">{{ t('steamImport.foundCount', { count: games.length }) }}</p>

        <div class="search-wrap">
          <AppIcon name="search" :size="17" class="search-icon" />
          <input v-model="searchQuery" type="search" class="input search-input" :placeholder="t('steamImport.searchPlaceholder')" :aria-label="t('steamImport.searchPlaceholder')" />
        </div>

        <div class="bulk-actions">
          <button class="btn btn-ghost btn-sm" type="button" @click="selectAllVisible">{{ t('steamImport.selectAll') }}</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="selectNoneVisible">{{ t('steamImport.selectNone') }}</button>
        </div>
      </div>

      <p v-if="!filteredGames.length" class="empty-msg">{{ t('steamImport.emptyResults') }}</p>

      <div v-else class="game-list">
        <label
          v-for="g in filteredGames"
          :key="g.appid"
          class="game-row"
          :class="{ checked: selected.has(g.appid) }"
        >
          <input type="checkbox" :checked="selected.has(g.appid)" @change="toggle(g.appid)" />
          <img :src="g.cover" :alt="g.title" loading="lazy" class="row-cover" />
          <span class="row-title">{{ g.title }}</span>
          <span class="row-hours mono">{{ hoursLabel(g.playtimeMinutes) }}</span>
        </label>
      </div>

      <div class="import-bar">
        <label class="status-pick">
          <span>{{ t('steamImport.statusLabel') }}</span>
          <select v-model="importStatus" class="input status-select">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_ICONS[s] }} {{ t(`status.${s}`) }}</option>
          </select>
        </label>

        <p class="selected-count mono">{{ t('steamImport.selectedCount', { count: selected.size }) }}</p>

        <p v-if="importError" class="error-msg">{{ importError }}</p>

        <button
          class="btn btn-primary import-btn"
          :disabled="!selected.size || importing"
          @click="runImport"
        >
          {{ importing ? t('steamImport.importing', importProgress) : t('steamImport.importCta', { count: selected.size }) }}
        </button>
      </div>
    </section>

    <!-- step 3: done -->
    <section v-else class="done-card">
      <p class="done-title">{{ t('steamImport.importDone', { count: importResult.added }) }}</p>
      <p class="done-sub">{{ t('steamImport.importDoneMatched', { count: importResult.matched }) }}</p>
      <div class="done-actions">
        <router-link :to="{ name: 'my-games' }" class="btn btn-primary">{{ t('steamImport.importDoneCta') }}</router-link>
        <button class="btn btn-ghost" @click="startOver">{{ t('steamImport.importAnother') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.steam-view { padding-bottom: 100px; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px 0 8px;
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  text-decoration: none;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}
.back-link:hover { color: var(--text-0); border-color: var(--paper); }

.steam-header { padding: 24px 0 28px; }
.steam-header .tape :deep(svg) { margin-right: 2px; }
.steam-header h1 { margin-top: 18px; font-size: clamp(30px, 4.4vw, 52px); font-weight: 800; letter-spacing: -0.035em; }
.subtitle { color: var(--text-1); font-size: 16px; margin: 12px 0 0; max-width: 560px; line-height: 1.55; }

.lookup-card {
  max-width: 520px;
  padding: 28px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line-strong);
  border-radius: var(--radius-lg);
  box-shadow: 8px 8px 0 #66c0f4;
}
.lookup-card .submit-btn + .submit-btn { margin-top: 10px; }
.loading-block { color: var(--text-2); font-size: 14px; padding: 40px 0; text-align: center; letter-spacing: 0.06em; }
.lookup-form { display: flex; flex-direction: column; gap: 16px; }
.field-label .input { font-family: var(--font-body); letter-spacing: 0; text-transform: none; }
.input-hint { font-family: var(--font-body); font-size: 12px; color: var(--text-2); font-weight: 400; letter-spacing: 0; text-transform: none; }
.submit-btn { width: 100%; min-height: 48px; margin-top: 4px; }
.error-msg { color: var(--st-dropped); font-size: 14px; margin: 0 0 14px; line-height: 1.5; }

.picker-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.found-count {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-1);
  white-space: nowrap;
}

.search-wrap { position: relative; flex: 1 1 240px; min-width: 180px; }
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-2);
  pointer-events: none;
}
.search-wrap:focus-within .search-icon { color: var(--acid); }
.search-input { padding-left: 40px; -webkit-appearance: none; appearance: none; }

.bulk-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-sm { min-height: 40px; padding: 0 12px; font-size: 13px; }

.empty-msg { color: var(--text-2); text-align: center; padding: 40px 0; }

.game-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
  max-height: 520px;
  overflow-y: auto;
  padding: 2px 6px 2px 2px;
  margin-bottom: 110px;
}
.game-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: var(--stroke) solid var(--line);
  background: var(--bg-1);
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.game-row:hover { border-color: var(--line-strong); }
.game-row.checked { border-color: var(--acid); background: color-mix(in srgb, var(--acid) 8%, var(--bg-1)); }
.game-row input[type='checkbox'] { flex-shrink: 0; width: 18px; height: 18px; accent-color: var(--acid); cursor: pointer; }
.row-cover { width: 70px; height: 33px; object-fit: cover; border-radius: 3px; flex-shrink: 0; background: var(--bg-2); }
.row-title { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--text-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-hours { font-size: 11px; color: var(--text-2); flex-shrink: 0; }

.import-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 14px max(24px, calc((100vw - 1360px) / 2 + 24px));
  background: color-mix(in srgb, var(--bg-0) 92%, transparent);
  backdrop-filter: blur(10px);
  border-top: var(--stroke) solid var(--acid);
}
.status-pick {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-1);
}
.status-select { width: auto; min-height: 42px; padding: 0 12px; font-size: 14px; font-family: var(--font-body); letter-spacing: 0; text-transform: none; }
.selected-count { font-size: 12px; color: var(--text-1); flex: 1; margin: 0; letter-spacing: 0.04em; }
.import-bar .error-msg { margin: 0; }
.import-btn { min-height: 48px; }

.done-card {
  max-width: 520px;
  padding: 36px 30px;
  text-align: center;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line-strong);
  border-radius: var(--radius-lg);
  box-shadow: 8px 8px 0 var(--st-completed);
}
.done-title { font-family: var(--font-display); font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 10px; }
.done-sub { color: var(--text-1); font-size: 14px; margin: 0 0 24px; }
.done-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

@media (max-width: 600px) {
  .lookup-card { padding: 20px; box-shadow: 5px 5px 0 #66c0f4; }
  .game-list { grid-template-columns: 1fr; }
  .row-cover { width: 52px; height: 25px; }
  .import-bar { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 16px; }
  .import-btn { width: 100%; }
}
</style>
