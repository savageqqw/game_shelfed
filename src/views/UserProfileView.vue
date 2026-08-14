<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { STATUSES, STATUS_ICONS } from '../stores/library'
import { api } from '../utils/api'
import GameCard from '../components/GameCard.vue'
import CategoryTabs from '../components/CategoryTabs.vue'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const profile = ref(null)
const loading = ref(true)
const error = ref(null)
const activeTab = ref('all')

const counts = computed(() => {
  const c = { planned: 0, playing: 0, completed: 0, dropped: 0 }
  for (const i of profile.value?.items || []) c[i.status] = (c[i.status] || 0) + 1
  return c
})

const filtered = computed(() => {
  const items = profile.value?.items || []
  return activeTab.value === 'all' ? items : items.filter((i) => i.status === activeTab.value)
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

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase()
}

async function load() {
  loading.value = true
  error.value = null
  activeTab.value = 'all'
  try {
    profile.value = await api.get('/user-profile', auth.token, { username: route.params.username })
  } catch (e) {
    error.value = e.message
    profile.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.params.username, load)
onMounted(load)
</script>

<template>
  <div class="shell profile-view">
    <div v-if="loading" class="status-msg">{{ t('search.loading') }}</div>
    <div v-else-if="error" class="status-msg error-msg">{{ error }}</div>

    <template v-else-if="profile">
      <header class="profile-header">
        <div class="profile-avatar">
          <img v-if="profile.avatar" :src="profile.avatar" :alt="profile.username" />
          <span v-else class="profile-avatar-fallback mono">{{ initials(profile.username) }}</span>
        </div>
        <div>
          <h1>{{ profile.username }}</h1>
          <p class="stat mono">{{ t('users.gameCount', { count: profile.items.length }) }}</p>
        </div>
        <CategoryTabs v-if="profile.items.length" v-model="activeTab" :counts="counts" class="profile-tabs" />
      </header>

      <div v-if="!profile.items.length" class="status-msg">{{ t('users.profileEmpty') }}</div>
      <div v-else-if="!filtered.length" class="status-msg">{{ t('myGames.noResults') }}</div>

      <div v-else class="game-grid">
        <GameCard
          v-for="item in filtered"
          :key="item.game_id"
          :game="toCardGame(item)"
          :status="item.status"
          :user-rating="item.rating"
          readonly
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile-view { padding-bottom: 60px; }
.profile-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 24px 0 32px;
}
.profile-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.profile-avatar-fallback { font-size: 18px; font-weight: 700; color: var(--text-2); }
.profile-header h1 { font-size: clamp(22px, 3.2vw, 30px); margin: 0; }
.stat { color: var(--text-2); font-size: 12px; margin-top: 4px; }
.profile-tabs { margin-left: auto; }

.status-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 20px;
}
</style>
