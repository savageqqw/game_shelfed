<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import GameCard from '../components/GameCard.vue'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()

const query = ref('')
const games = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const searched = ref(false)
const error = ref(null)
const catalogCount = ref(null)
let debounceHandle = null

function formatCount(n) {
  if (!n) return null
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`
  return String(n)
}

async function loadPage(reset = false) {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/games-search', null, {
      q: query.value,
      page: reset ? 1 : page.value
    })
    games.value = reset ? res.results : [...games.value, ...res.results]
    hasMore.value = !!res.hasMore
    page.value = (reset ? 1 : page.value) + 1
    searched.value = true
    if (!query.value && res.count) catalogCount.value = res.count
  } catch (e) {
    error.value = e.message
    if (reset) games.value = []
  } finally {
    loading.value = false
  }
}

function onInput() {
  clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => loadPage(true), 380)
}

async function setStatus(game, status) {
  if (!auth.isAuthed) {
    window.location.assign('/login')
    return
  }
  await library.upsert(game, status)
}

onMounted(() => {
  loadPage(true)
  if (auth.isAuthed && !library.loaded) library.fetchAll()
})

watch(() => auth.isAuthed, (v) => { if (v && !library.loaded) library.fetchAll() })
</script>

<template>
  <div class="shell lib-view">
    <header class="hero">
      <div class="hero-copy">
        <p class="call-number mono">КАТ. № 000-GM · {{ t('library.eyebrow') }}</p>
        <h1 class="hero-title">{{ t('library.title') }}</h1>
        <p class="subtitle">{{ t('library.subtitle') }}</p>

        <div class="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input
            v-model="query"
            class="input search-input"
            type="text"
            :placeholder="t('search.placeholder')"
            @input="onInput"
          />
        </div>

        <ul class="stat-chips">
          <li class="chip chip-amber">
            <span class="chip-label"><span class="dot" />{{ t('library.stats.games') }}</span>
            <span class="chip-num mono">{{ formatCount(catalogCount) || '500k+' }}</span>
          </li>
          <li class="chip chip-teal">
            <span class="chip-label"><span class="dot" />{{ t('library.stats.statuses') }}</span>
            <span class="chip-num mono">4</span>
          </li>
          <li class="chip chip-violet">
            <span class="chip-label"><span class="dot" />{{ t('library.stats.langs') }}</span>
            <span class="chip-num mono">3</span>
          </li>
        </ul>
      </div>

      <div class="hero-art" aria-hidden="true">
        <svg viewBox="0 0 220 220" class="tag-stack">
          <g transform="translate(30,20) rotate(-6)">
            <rect x="0" y="0" width="120" height="150" rx="10" fill="var(--bg-2)" stroke="var(--border-strong)" stroke-width="2" />
            <rect x="16" y="20" width="88" height="52" rx="6" fill="var(--bg-3)" />
            <rect x="16" y="84" width="60" height="10" rx="4" fill="var(--accent-amber)" />
            <rect x="16" y="102" width="88" height="6" rx="3" fill="var(--border-soft)" />
            <rect x="16" y="116" width="60" height="6" rx="3" fill="var(--border-soft)" />
          </g>
          <g transform="translate(70,58) rotate(9)">
            <rect x="0" y="0" width="120" height="150" rx="10" fill="var(--bg-1)" stroke="var(--border-strong)" stroke-width="2" />
            <rect x="16" y="20" width="88" height="52" rx="6" fill="var(--bg-3)" />
            <rect x="16" y="84" width="60" height="10" rx="4" fill="var(--accent-violet)" />
            <rect x="16" y="102" width="88" height="6" rx="3" fill="var(--border-soft)" />
            <rect x="16" y="116" width="60" height="6" rx="3" fill="var(--border-soft)" />
          </g>
        </svg>
      </div>
    </header>

    <p v-if="error" class="status-msg error-msg">
      <strong>{{ t('search.errorTitle') }}</strong><br />
      {{ error }}
    </p>
    <p v-else-if="searched && !loading && games.length === 0" class="status-msg">
      {{ t('search.noResults', { query }) }}
    </p>

    <transition-group tag="div" name="grid-fade" class="game-grid">
      <GameCard
        v-for="g in games"
        :key="g.id"
        :game="g"
        :status="library.entryFor(g.id)?.status"
        @set-status="(s) => setStatus(g, s)"
        @remove="library.remove(g.id)"
      />
    </transition-group>

    <div class="load-more-row">
      <p v-if="loading" class="loading-msg mono">{{ t('search.loading') }}</p>
      <button v-else-if="hasMore && games.length" class="btn" @click="loadPage(false)">
        {{ t('search.loadMore') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lib-view { padding-bottom: 60px; }

.hero {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: 32px;
  align-items: center;
  padding: 30px 0 40px;
}
.hero-copy { min-width: 0; }
.call-number {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-amber);
  margin: 0 0 14px;
}
.hero-title {
  font-family: var(--font-display);
  font-size: clamp(26px, 3.6vw, 40px);
  line-height: 1.15;
  letter-spacing: 0;
}
.subtitle { color: var(--text-2); margin: 14px 0 24px; font-size: 15px; max-width: 520px; }

.stat-chips {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  margin: 26px 0 0;
  padding: 0;
}
.chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chip-label {
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
}
.chip-amber .dot { background: var(--accent-amber); }
.chip-teal .dot { background: var(--accent-teal); }
.chip-violet .dot { background: var(--accent-violet); }
.chip-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-0);
  letter-spacing: -0.01em;
}

.search-bar {
  position: relative;
  max-width: 480px;
}
.search-bar svg {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-2);
  pointer-events: none;
}
.search-input { padding-left: 44px; font-size: 15px; }

.hero-art {
  display: flex;
  justify-content: center;
}
.tag-stack { width: 100%; max-width: 260px; height: auto; }

.status-msg {
  color: var(--text-2);
  padding: 22px 24px;
  text-align: left;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.5;
}
.error-msg {
  border-color: rgba(232, 92, 74, 0.4);
  color: var(--status-dropped);
}
.error-msg strong { color: var(--text-0); }

.game-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 20px;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 36px 0 10px;
}
.loading-msg { color: var(--text-2); font-size: 13px; }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; }
  .hero-art { display: none; }
}
</style>
