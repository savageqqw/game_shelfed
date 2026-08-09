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
  return { id: item.game_id, title: item.title, cover: item.cover }
}

onMounted(() => {
  if (!library.loaded) library.fetchAll()
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
        <span class="stat-num mono">{{ library.counts[s] || 0 }}</span>
        <span class="stat-label">{{ t(`status.${s}`) }}</span>
      </button>
    </div>

    <div v-if="library.loading && !library.loaded" class="loading-msg mono">{{ t('search.loading') }}</div>

    <div v-else-if="!library.items.length" class="empty-state">
      <p>{{ t('myGames.empty') }}</p>
      <router-link :to="{ name: 'library' }" class="btn btn-primary">{{ t('myGames.emptyCta') }}</router-link>
    </div>

    <transition-group v-else tag="div" name="grid-fade" class="game-grid">
      <GameCard
        v-for="item in filtered"
        :key="item.game_id"
        :game="toCardGame(item)"
        :status="item.status"
        @set-status="(s) => library.upsert(toCardGame(item), s)"
        @remove="library.remove(item.game_id)"
      />
    </transition-group>
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
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  text-align: left;
  border-left: 3px solid transparent;
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast);
}
.stat-card:hover { transform: translateY(-2px); }
.stat-num { font-size: 24px; font-weight: 700; color: var(--text-0); }
.stat-label { font-size: 12px; color: var(--text-2); }
.stat-card.s-completed { border-left-color: var(--status-completed); }
.stat-card.s-planned { border-left-color: var(--status-planned); }
.stat-card.s-playing { border-left-color: var(--status-playing); }
.stat-card.s-dropped { border-left-color: var(--status-dropped); }
.stat-card.active { border-color: var(--border-strong); background: var(--bg-2); }

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
