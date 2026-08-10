<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore, STATUSES } from '../stores/library'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'

const { t } = useI18n()
const library = useLibraryStore()
const activeTab = ref('all')

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
        class="stat-item"
        :class="[`s-${s}`, { active: activeTab === s }]"
        @click="activeTab = s"
      >
        <span class="stat-label"><span class="dot" />{{ t(`status.${s}`) }}</span>
        <span class="stat-num mono">{{ library.counts[s] || 0 }}</span>
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
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-bottom: 34px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: none;
  border: none;
  padding: 0 0 4px;
  text-align: left;
  border-bottom: 2px solid transparent;
  transition: border-color var(--dur-fast);
}
.stat-item:hover { border-bottom-color: var(--border-strong); }
.stat-item.active { border-bottom-color: currentColor; }
.stat-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}
.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.stat-num { font-size: 22px; font-weight: 700; color: var(--text-0); letter-spacing: -0.01em; }
.stat-item.s-completed { color: var(--status-completed); }
.stat-item.s-planned { color: var(--status-planned); }
.stat-item.s-playing { color: var(--status-playing); }
.stat-item.s-dropped { color: var(--status-dropped); }
.stat-item .dot { background: currentColor; }

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
