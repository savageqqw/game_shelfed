<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICONS } from '../stores/library'
import { api } from '../utils/api'

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

// step 3 — import
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
  try {
    const res = await api.post('/steam-import', { status: importStatus.value, games: picked }, auth.token)
    importResult.value = res
    await library.fetchAll()
  } catch (e) {
    importError.value = e.message || t('steamImport.genericError')
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
    <router-link :to="{ name: 'my-games' }" class="back-link">{{ t('steamImport.back') }}</router-link>

    <header class="steam-header">
      <h1>{{ t('steamImport.title') }}</h1>
      <p class="subtitle">{{ t('steamImport.subtitle') }}</p>
    </header>

    <!-- step 1: find the profile (only for accounts not signed in via Steam) -->
    <section v-if="phase === 'checking' || phase === 'loading'" class="loading-block mono">
      {{ t('steamImport.fetching') }}
    </section>

    <section v-else-if="phase === 'input'" class="card-surface lookup-card">
      <form @submit.prevent="fetchLibrary" class="lookup-form">
        <label>
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

    <section v-else-if="phase === 'error'" class="card-surface lookup-card">
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
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input v-model="searchQuery" type="text" class="search-input" :placeholder="t('steamImport.searchPlaceholder')" />
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

      <div class="import-bar card-surface">
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
          {{ importing ? t('steamImport.importing') : t('steamImport.importCta', { count: selected.size }) }}
        </button>
      </div>
    </section>

    <!-- step 3: done -->
    <section v-else class="card-surface done-card">
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
.steam-view { padding-bottom: 80px; }
.back-link {
  display: inline-block;
  margin-top: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  text-decoration: none;
}
.back-link:hover { color: var(--text-0); }

.steam-header { padding: 16px 0 28px; }
.steam-header h1 { font-size: clamp(24px, 4vw, 32px); }
.subtitle { color: var(--text-2); font-size: 14px; margin-top: 8px; max-width: 520px; }

.lookup-card { max-width: 480px; padding: 32px; }
.lookup-card .submit-btn + .submit-btn { margin-top: 10px; }
.loading-block { color: var(--text-2); font-size: 14px; padding: 40px 0; text-align: center; }
.lookup-form { display: flex; flex-direction: column; gap: 16px; }
.lookup-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-1); font-weight: 600; }
.input-hint { font-size: 12px; color: var(--text-2); font-weight: 400; }
.submit-btn { padding: 12px; margin-top: 4px; }
.error-msg { color: var(--status-dropped); font-size: 13px; margin: 0; line-height: 1.5; }

.picker-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 18px;
}
.found-count { font-size: 13px; color: var(--text-2); white-space: nowrap; }

.search-wrap { position: relative; flex: 1 1 220px; min-width: 180px; }
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-2);
  font-size: 14px;
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 9px 14px 9px 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  color: var(--text-0);
  font-size: 13px;
  font-family: inherit;
}
.search-input:focus { outline: none; border-color: var(--accent-amber); background: var(--bg-2); }

.bulk-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-sm { padding: 8px 12px; font-size: 12px; }

.empty-msg { color: var(--text-2); text-align: center; padding: 40px 0; }

.game-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 460px;
  overflow-y: auto;
  padding-right: 4px;
  margin-bottom: 100px;
}
.game-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.game-row:hover { border-color: var(--border-strong); }
.game-row.checked { border-color: var(--accent-amber); background: var(--bg-2); }
.game-row input[type='checkbox'] { flex-shrink: 0; width: 16px; height: 16px; accent-color: var(--accent-amber); cursor: pointer; }
.row-cover { width: 64px; height: 30px; object-fit: cover; border-radius: 5px; flex-shrink: 0; background: var(--bg-2); }
.row-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--text-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  padding: 16px max(20px, calc((100vw - 1360px) / 2 + 20px));
  border-radius: 0;
  border-top: 1px solid var(--border-soft);
  box-shadow: 0 -10px 30px -14px rgba(0, 0, 0, 0.5);
}
.status-pick { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); font-weight: 600; }
.status-select { width: auto; padding: 8px 12px; font-size: 13px; }
.selected-count { font-size: 12px; color: var(--text-2); flex: 1; }
.import-btn { padding: 11px 20px; white-space: nowrap; }

.done-card { max-width: 480px; padding: 40px 32px; text-align: center; }
.done-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.done-sub { color: var(--text-2); font-size: 13px; margin: 0 0 24px; }
.done-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

@media (max-width: 600px) {
  .lookup-card { padding: 22px; }
  .row-cover { width: 48px; height: 24px; }
  .import-bar { flex-direction: column; align-items: stretch; gap: 10px; }
  .import-btn { width: 100%; }
}
</style>
