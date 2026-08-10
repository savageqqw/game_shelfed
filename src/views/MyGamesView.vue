<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore, STATUSES } from '../stores/library'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'

const { t } = useI18n()
const library = useLibraryStore()
const activeTab = ref('all')

const STAT_ICONS = {
  planned: '▤',
  playing: '▶',
  completed: '✓',
  dropped: '✕'
}

const filtered = computed(() => {
  if (activeTab.value === 'all') return library.items
  return library.byStatus(activeTab.value)
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
        <span class="stat-icon mono">{{ STAT_ICONS[s] }}</span>
        <span class="stat-text">
          <span class="stat-num mono">{{ library.counts[s] || 0 }}</span>
          <span class="stat-label">{{ t(`status.${s}`) }}</span>
        </span>
      </button>
    </div>

    <div v-if="library.loading && !library.loaded" class="loading-msg mono">{{ t('search.loading') }}</div>

    <div v-else-if="!library.items.length" class="empty-state">
      <p>{{ t('myGames.empty') }}</p>
      <router-link :to="{ name: 'library' }" class="btn btn-primary">{{ t('myGames.emptyCta') }}</router-link>
    </div>

    <div v-else class="game-grid">
      <GameCard
        v-for="item in filtered"
        :key="item.game_id"
        :game="toCardGame(item)"
        :status="item.status"
        :user-rating="item.rating"
        :show-rating="true"
        @set-status="(s) => library.upsert(toCardGame(item), s)"
        @set-rating="(r) => library.rate(item.game_id, r)"
        @remove="library.remove(item.game_id)"
      />
    </div>
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

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.game-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 20px;
}
</style>
