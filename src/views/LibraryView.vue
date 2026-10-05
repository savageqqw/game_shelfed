<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { useSeo } from '../composables/useSeo'
import GameCard from '../components/GameCard.vue'
import AppIcon from '../components/AppIcon.vue'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()

useSeo(() => ({
  path: '/',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Game Shelfed',
    url: 'https://game-shelfed.pp.ua/',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://game-shelfed.pp.ua/?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  }
}))

const query = ref('')
const games = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const searched = ref(false)
const error = ref(null)
const catalogCount = ref(null)
const searchEl = ref(null)
// the hero shelf is filled once from the first (no-query) page and then
// left alone, so typing in the search box doesn't reshuffle it
const shelf = ref([])
let debounceHandle = null

// Regenerated on every page load so the default (no-query) catalog view
// shows a fresh shuffle of currently-popular games each visit, while
// "load more" pagination within one visit stays consistent (same seed).
const seed = Math.random().toString(36).slice(2)

function formatCount(n) {
  if (!n) return null
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`
  return String(n)
}

const tickerItems = computed(() => [
  `${formatCount(catalogCount.value) || '500k+'} ${t('library.stats.games')}`,
  `4 ${t('library.stats.statuses')}`,
  `3 ${t('library.stats.ratings')}`,
  t('myGames.steamCta'),
  t('myGames.dealsEyebrow')
])

// one face-out box plus spines, the way a real shelf is stocked
const shelfFace = computed(() => shelf.value[0] || null)
const shelfSpines = computed(() => shelf.value.slice(1, 7))

async function loadPage(reset = false) {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/games-search', null, {
      q: query.value,
      page: reset ? 1 : page.value,
      seed
    })
    games.value = reset ? res.results : [...games.value, ...res.results]
    hasMore.value = !!res.hasMore
    page.value = (reset ? 1 : page.value) + 1
    searched.value = true
    if (!query.value && res.catalogTotal) catalogCount.value = res.catalogTotal
    if (!query.value && !shelf.value.length) shelf.value = res.results.filter((g) => g.cover).slice(0, 7)
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

function clearSearch() {
  query.value = ''
  loadPage(true)
  searchEl.value?.focus()
}

async function setStatus(game, status) {
  if (!auth.isAuthed) {
    window.location.assign('/login')
    return
  }
  await library.upsert(game, status)
}

// "/" jumps to the search box from anywhere on the page
function onHotkey(e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const el = e.target
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
  e.preventDefault()
  searchEl.value?.focus()
}

onMounted(() => {
  loadPage(true)
  if (auth.isAuthed && !library.loaded) library.fetchAll()
  window.addEventListener('keydown', onHotkey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onHotkey))

watch(() => auth.isAuthed, (v) => {
  if (v && !library.loaded) library.fetchAll()
})
</script>

<template>
  <div class="lib-view">
    <header class="shell hero">
      <div class="hero-copy">
        <span class="tape">{{ t('library.eyebrow') }}</span>
        <h1 class="hero-title">
          <span class="line">{{ t('library.title') }}</span>
          <span class="line"><span class="marker">{{ t('library.titleAccent') }}</span></span>
        </h1>
        <p class="subtitle">{{ t('library.subtitle') }}</p>

        <div class="search-bar">
          <AppIcon name="search" :size="20" :stroke="2.25" class="search-icon" />
          <label for="catalog-search" class="sr-only">{{ t('search.placeholder') }}</label>
          <input
            id="catalog-search"
            ref="searchEl"
            v-model="query"
            class="search-input"
            type="search"
            autocomplete="off"
            :placeholder="t('search.placeholder')"
            @input="onInput"
          />
          <button v-if="query" class="search-clear" type="button" @click="clearSearch" :aria-label="t('myGames.searchClear')">
            <AppIcon name="x" :size="16" :stroke="2.5" />
          </button>
          <span v-else class="kbd search-kbd" aria-hidden="true">/</span>
        </div>
      </div>

      <div class="hero-shelf">
        <div class="shelf-row">
          <template v-if="shelfFace">
            <router-link
              v-for="(g, i) in shelfSpines.slice(0, 2)"
              :key="g.id"
              :to="{ name: 'game-detail', params: { id: g.id } }"
              class="spine"
              :class="`sp-${i}`"
              :style="{ backgroundImage: `url(${g.cover})` }"
              :aria-label="g.title"
            ><span class="spine-title mono">{{ g.title }}</span></router-link>

            <router-link :to="{ name: 'game-detail', params: { id: shelfFace.id } }" class="face" :aria-label="shelfFace.title">
              <img :src="shelfFace.cover" :alt="shelfFace.title" />
              <span class="face-tag mono">{{ t('library.shelfPick') }}</span>
            </router-link>

            <router-link
              v-for="(g, i) in shelfSpines.slice(2)"
              :key="g.id"
              :to="{ name: 'game-detail', params: { id: g.id } }"
              class="spine"
              :class="`sp-${i + 2}`"
              :style="{ backgroundImage: `url(${g.cover})` }"
              :aria-label="g.title"
            ><span class="spine-title mono">{{ g.title }}</span></router-link>
          </template>
          <template v-else>
            <span v-for="n in 2" :key="'a' + n" class="spine skeleton" :class="`sp-${n - 1}`" />
            <span class="face skeleton" />
            <span v-for="n in 4" :key="'b' + n" class="spine skeleton" :class="`sp-${n + 1}`" />
          </template>
        </div>
        <div class="plank" aria-hidden="true" />
        <div class="price-tag mono" aria-hidden="true">
          <span class="price-num">{{ formatCount(catalogCount) || '500k+' }}</span>
          <span class="price-label">{{ t('library.stats.games') }}</span>
          <span class="barcode"><span v-for="n in 18" :key="n" /></span>
        </div>
      </div>
    </header>

    <div class="ticker" aria-hidden="true">
      <div class="ticker-track">
        <template v-for="n in 2" :key="n">
          <span v-for="(item, i) in tickerItems" :key="`${n}-${i}`" class="tick">{{ item }}<span class="tick-star">✦</span></span>
        </template>
      </div>
    </div>

    <section class="shell catalog">
      <h2 class="rule-head">
        {{ query ? t('library.gridResults') : t('library.gridPopular') }}
        <span v-if="games.length" class="rule-count">{{ String(games.length).padStart(3, '0') }}</span>
      </h2>

      <p v-if="error" class="status-msg error-msg">
        <strong>{{ t('search.errorTitle') }}</strong><br />
        {{ error }}
      </p>
      <p v-else-if="searched && !loading && games.length === 0" class="status-msg">
        {{ t('search.noResults', { query }) }}
      </p>

      <div v-if="loading && !games.length" class="game-grid" aria-hidden="true">
        <div v-for="n in 12" :key="n" class="skel-card">
          <div class="skel-art" />
          <div class="skel-line" />
          <div class="skel-line short" />
        </div>
      </div>

      <transition-group v-else tag="div" name="grid-fade" class="game-grid">
        <GameCard
          v-for="g in games"
          :key="g.id"
          :game="g"
          :status="library.entryFor(g.id)?.status"
          :user-rating="library.entryFor(g.id)?.rating"
          @set-status="(s) => setStatus(g, s)"
          @set-rating="(r) => library.rate(g.id, r)"
          @remove="library.remove(g.id)"
        />
      </transition-group>

      <div class="load-more-row">
        <p v-if="loading && games.length" class="loading-msg mono">{{ t('search.loading') }}</p>
        <button v-else-if="hasMore && games.length" class="btn btn-outline load-more" @click="loadPage(false)">
          {{ t('search.loadMore') }}
          <AppIcon name="arrow-right" :size="16" class="load-more-icon" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lib-view {
  padding-bottom: 40px;
  overflow-x: clip;
}

/* ---------------- hero ---------------- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 40px;
  align-items: end;
  padding-top: 28px;
  padding-bottom: 56px;
}
.hero-copy { min-width: 0; padding-bottom: 8px; }
.hero-title {
  margin: 22px 0 0;
  font-size: clamp(34px, 4.7vw, 66px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.035em;
}
.hero-title .line { display: block; }
.marker {
  display: inline-block;
  margin-top: 0.12em;
  padding: 0.02em 0.18em 0.08em;
  background: var(--acid);
  color: var(--ink);
  transform: rotate(-1.2deg);
  box-shadow: 6px 6px 0 var(--paper);
}
.subtitle {
  color: var(--text-1);
  margin: 26px 0 28px;
  font-size: 17px;
  line-height: 1.55;
  max-width: 520px;
}

.search-bar {
  position: relative;
  max-width: 560px;
}
.search-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-1);
  pointer-events: none;
}
.search-input {
  width: 100%;
  height: 60px;
  padding: 0 56px 0 52px;
  border-radius: var(--radius-md);
  border: var(--stroke) solid var(--paper);
  background: var(--bg-1);
  color: var(--text-0);
  font-size: 17px;
  font-weight: 500;
  transition: box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast), transform var(--dur-fast) var(--ease-out);
  -webkit-appearance: none;
  appearance: none;
}
.search-input::-webkit-search-cancel-button { display: none; }
.search-input::placeholder { color: var(--text-2); }
.search-input:focus {
  outline: none;
  border-color: var(--acid);
  box-shadow: 6px 6px 0 var(--acid);
  transform: translate(-2px, -2px);
}
.search-bar:focus-within .search-icon { color: var(--acid); }
.search-kbd {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-1);
}
.search-clear:hover { background: var(--bg-3); color: var(--text-0); }

/* ---------------- shelf ---------------- */
.hero-shelf {
  position: relative;
  padding: 0 8px;
  min-width: 0;
}
.shelf-row {
  height: 300px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
}
.spine {
  position: relative;
  flex-shrink: 0;
  width: 46px;
  height: 84%;
  border-radius: 3px 3px 0 0;
  background-size: 900% auto;
  background-position: center 30%;
  border: var(--stroke) solid var(--ink);
  border-bottom: none;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12px;
  text-decoration: none;
  transition: transform var(--dur-med) var(--ease-spring);
}
.spine::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.15) 30%, rgba(255, 255, 255, 0.08) 55%, rgba(0, 0, 0, 0.5) 100%),
    rgba(12, 12, 14, 0.35);
}
.spine::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 14px;
  height: 14px;
  background: var(--paper);
  opacity: 0.85;
}
.spine-title {
  position: relative;
  z-index: 1;
  writing-mode: vertical-rl;
  max-height: calc(100% - 52px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--paper);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.spine:hover { transform: translateY(-14px); }
.sp-0 { height: 80%; width: 42px; }
.sp-1 { height: 90%; width: 50px; }
.sp-2 { height: 86%; width: 44px; }
.sp-3 { height: 94%; width: 48px; }
.sp-4 { height: 78%; width: 40px; }
.sp-5 {
  height: 88%;
  width: 46px;
  transform-origin: bottom left;
  transform: rotate(9deg) translateX(6px);
}
.sp-5:hover { transform: rotate(4deg) translate(6px, -10px); }

.face {
  position: relative;
  flex-shrink: 0;
  height: 100%;
  aspect-ratio: 3 / 4;
  margin: 0 6px;
  border: var(--stroke) solid var(--paper);
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  overflow: hidden;
  background: var(--bg-2);
  transition: transform var(--dur-med) var(--ease-spring);
}
.face img { width: 100%; height: 100%; object-fit: cover; display: block; }
.face:hover { transform: translateY(-10px) rotate(-1.5deg); }
.face-tag {
  position: absolute;
  top: 10px;
  right: -4px;
  padding: 4px 10px 3px;
  background: var(--hot);
  color: var(--ink);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transform: rotate(4deg);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
}

.skeleton {
  background: repeating-linear-gradient(-45deg, var(--bg-2) 0 6px, var(--bg-1) 6px 12px);
  border-color: var(--line);
  animation: skel-pulse 1.4s ease-in-out infinite alternate;
}
.skeleton::before, .skeleton::after { display: none; }

.plank {
  position: relative;
  height: 18px;
  margin: 0 -8px;
  background: var(--bg-3);
  border-top: 3px solid var(--paper);
  border-radius: 0 0 3px 3px;
  box-shadow: 0 14px 24px -10px rgba(0, 0, 0, 0.8);
}
.price-tag {
  position: absolute;
  right: 28px;
  bottom: -40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: var(--paper);
  color: var(--ink);
  border-radius: 2px;
  transform: rotate(-2.5deg);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
}
.price-num { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
.price-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; max-width: 90px; line-height: 1.2; }
.price-tag .barcode { height: 22px; }
.price-tag .barcode span { background: var(--ink); }

/* ---------------- ticker ---------------- */
.ticker {
  position: relative;
  width: 104%;
  margin: 8px -2% 0;
  background: var(--acid);
  color: var(--ink);
  border-top: var(--stroke) solid var(--ink);
  border-bottom: var(--stroke) solid var(--ink);
  transform: rotate(-1.4deg);
  overflow: hidden;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.35);
}
.ticker-track {
  display: flex;
  width: max-content;
  animation: ticker 42s linear infinite;
}
.ticker:hover .ticker-track { animation-play-state: paused; }
.tick {
  display: inline-flex;
  align-items: center;
  gap: 22px;
  padding: 12px 0 12px 22px;
  font-family: var(--font-display);
  font-size: clamp(15px, 1.6vw, 21px);
  font-weight: 800;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  white-space: nowrap;
}
.tick-star { font-size: 0.8em; }
@keyframes ticker {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ---------------- catalog ---------------- */
.catalog { padding-top: 64px; }

.status-msg {
  color: var(--text-1);
  padding: 20px 22px;
  border: var(--stroke) dashed var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  margin: 0 0 24px;
  font-size: 15px;
  line-height: 1.5;
}
.error-msg {
  border-color: var(--st-dropped);
  border-style: solid;
  color: var(--st-dropped);
}
.error-msg strong { color: var(--text-0); }

.game-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 22px;
}

.skel-card {
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--bg-1);
  padding-bottom: 14px;
  overflow: hidden;
}
.skel-art {
  aspect-ratio: 3 / 4;
  background: repeating-linear-gradient(-45deg, var(--bg-2) 0 6px, var(--bg-1) 6px 12px);
  border-bottom: var(--stroke) solid var(--line);
  animation: skel-pulse 1.4s ease-in-out infinite alternate;
}
.skel-line {
  height: 12px;
  margin: 14px 14px 0;
  background: var(--bg-3);
  border-radius: 2px;
  animation: skel-pulse 1.4s ease-in-out infinite alternate;
}
.skel-line.short { width: 45%; margin-top: 8px; }
@keyframes skel-pulse {
  from { opacity: 0.55; }
  to { opacity: 1; }
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 44px 0 10px;
}
.load-more { min-width: 220px; height: 52px; font-size: 15px; }
.load-more-icon { transform: rotate(90deg); }
.loading-msg { color: var(--text-2); font-size: 13px; letter-spacing: 0.06em; }

@media (max-width: 1100px) {
  .hero { grid-template-columns: 1fr; gap: 56px; padding-bottom: 64px; }
  .hero-shelf { max-width: 560px; }
}

@media (max-width: 900px) {
  .game-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
}

@media (max-width: 560px) {
  .hero { padding-top: 12px; gap: 48px; }
  .subtitle { font-size: 15px; margin: 20px 0 22px; }
  .marker { box-shadow: 4px 4px 0 var(--paper); }
  .search-input { height: 54px; font-size: 16px; }
  .search-kbd { display: none; }
  .shelf-row { height: 200px; gap: 3px; padding: 0; }
  .spine { width: 30px; padding-top: 8px; }
  .spine::after { left: 4px; right: 4px; height: 10px; bottom: 10px; }
  .spine-title { font-size: 9px; max-height: calc(100% - 36px); }
  .sp-0, .sp-4 { width: 28px; }
  .sp-1, .sp-3 { width: 32px; }
  .face { margin: 0 4px; }
  .face-tag { font-size: 9px; padding: 3px 7px 2px; }
  .price-tag { right: 10px; bottom: -36px; padding: 5px 9px; gap: 8px; }
  .price-num { font-size: 15px; }
  .price-tag .barcode { display: none; }
  .catalog { padding-top: 48px; }
  .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
}
</style>
