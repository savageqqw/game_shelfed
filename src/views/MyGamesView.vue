<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore, STATUSES, STATUS_ICONS } from '../stores/library'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'

const { t } = useI18n()
const library = useLibraryStore()
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
    rating: item.catalog_rating ?? null
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

onMounted(async () => {
  if (!library.loaded) await library.fetchAll()
  library.backfillMeta()
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
</style>
