<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { STATUSES, STATUS_ICONS } from '../stores/library'
import { api } from '../utils/api'

const { t, locale } = useI18n()
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

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase()
}

const LOCALE_TAGS = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' }

function formatDate(iso) {
  if (!iso) return ''
  try {
    const tag = LOCALE_TAGS[locale.value] || 'en-US'
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString(tag, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

function genreOf(item) {
  try {
    const g = item.genres ? JSON.parse(item.genres) : null
    return g?.[0] || null
  } catch {
    return null
  }
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
      <section class="banner card-surface">
        <div class="banner-who">
          <div class="profile-avatar">
            <img v-if="profile.avatar" :src="profile.avatar" :alt="profile.username" />
            <span v-else class="profile-avatar-fallback mono">{{ initials(profile.username) }}</span>
          </div>
          <div>
            <h1>
              {{ profile.username }}
              <span v-if="profile.isAdmin" class="admin-badge mono">{{ t('users.admin') }}</span>
              <span v-if="profile.steamLinked" class="steam-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.99 2 2.87 5.8 2.14 10.73l5.15 2.13a2.7 2.7 0 0 1 1.53-.47c.05 0 .1 0 .15.01l2.29-3.32v-.05a3.65 3.65 0 1 1 3.65 3.65h-.08l-3.27 2.33v.13a2.7 2.7 0 0 1-4.34 2.14L2.5 15.8C3.79 19.42 7.6 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2ZM8.3 17.5l-1.18-.49a1.98 1.98 0 0 0 1.02.9 2.02 2.02 0 0 0 2.63-1.1 2 2 0 0 0-1.09-2.62 2 2 0 0 0-1.52-.01l1.22.5a1.47 1.47 0 1 1-1.08 2.72v.1Zm7.65-6.34a2.44 2.44 0 1 1 0-4.87 2.44 2.44 0 0 1 0 4.87Zm0-.73a1.7 1.7 0 1 0 0-3.41 1.7 1.7 0 0 0 0 3.41Z" />
                </svg>
                {{ t('account.steamLinked') }}
              </span>
            </h1>
            <p class="joined mono">{{ t('users.joined', { date: formatDate(profile.createdAt) }) }}</p>
          </div>
        </div>

        <div class="banner-stats">
          <div class="stat-item">
            <span class="stat-num mono">{{ profile.items.length }}</span>
            <span class="stat-label">{{ t('users.statTotal') }}</span>
          </div>
          <div v-for="s in STATUSES" :key="s" class="stat-item" :class="`s-${s}`">
            <span class="stat-num mono">{{ counts[s] || 0 }}</span>
            <span class="stat-label">{{ t(`status.${s}`) }}</span>
          </div>
        </div>
      </section>

      <div v-if="profile.items.length" class="tabs-row">
        <button
          v-for="tab in ['all', ...STATUSES]"
          :key="tab"
          class="filter-tab"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab === 'all' ? t('myGames.tabs.all') : t(`status.${tab}`) }}
        </button>
      </div>

      <div v-if="!profile.items.length" class="status-msg">{{ t('users.profileEmpty') }}</div>
      <div v-else-if="!filtered.length" class="status-msg">{{ t('myGames.noResults') }}</div>

      <ul v-else class="game-list">
        <li v-for="item in filtered" :key="item.game_id" class="game-row">
          <div class="row-cover">
            <img v-if="item.cover" :src="item.cover" :alt="item.title" loading="lazy" />
            <span v-else class="row-cover-fallback mono">{{ initials(item.title) }}</span>
          </div>
          <span class="row-title">{{ item.title }}</span>
          <span v-if="item.catalog_rating" class="row-rating mono">★ {{ item.catalog_rating.toFixed(1) }}</span>
          <span v-if="item.released" class="row-year mono">{{ item.released.slice(0, 4) }}</span>
          <span v-if="genreOf(item)" class="row-genre">{{ genreOf(item) }}</span>
          <span class="row-status mono" :class="`s-${item.status}`">
            <span class="row-status-icon">{{ STATUS_ICONS[item.status] }}</span>
            {{ t(`status.${item.status}`) }}
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.profile-view { padding-bottom: 60px; }

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  padding: 24px 28px;
  margin: 24px 0 24px;
}
.banner-who { display: flex; align-items: center; gap: 14px; }
.profile-avatar {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.profile-avatar-fallback { font-size: 16px; font-weight: 700; color: var(--text-2); }
.banner-who h1 { font-size: clamp(20px, 2.8vw, 26px); margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.admin-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #17131a;
  background: var(--accent-amber-2);
  padding: 3px 8px;
  border-radius: 999px;
}
.steam-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #66c0f4;
  background: rgba(102, 192, 244, 0.14);
  border: 1px solid rgba(102, 192, 244, 0.3);
  padding: 4px 10px;
  border-radius: 999px;
}
.joined { color: var(--text-2); font-size: 12px; margin-top: 4px; }

.banner-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 26px;
}
.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-num { font-size: 20px; font-weight: 700; line-height: 1.1; color: var(--text-0); }
.stat-item.s-completed .stat-num { color: var(--status-completed); }
.stat-item.s-planned .stat-num { color: var(--status-planned); }
.stat-item.s-playing .stat-num { color: var(--status-playing); }
.stat-item.s-dropped .stat-num { color: var(--status-dropped); }
.stat-label { font-size: 11px; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.04em; }

.tabs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}
.filter-tab {
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--dur-fast), color var(--dur-fast), background var(--dur-fast);
}
.filter-tab:hover { color: var(--text-0); }
.filter-tab.active { background: var(--bg-2); color: var(--text-0); border-color: var(--border-strong); }

.status-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.game-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-soft);
  list-style: none;
  margin: 0;
  padding: 0;
}
.game-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-soft);
}
.row-cover {
  flex-shrink: 0;
  width: 34px;
  height: 46px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.row-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.row-cover-fallback { font-size: 11px; font-weight: 700; color: var(--text-2); }

.row-title {
  flex: 1 1 200px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-rating { flex-shrink: 0; font-size: 12px; color: var(--accent-amber-2); font-weight: 700; width: 40px; }
.row-year { flex-shrink: 0; font-size: 12px; color: var(--text-2); width: 40px; }
.row-genre {
  flex: 0 1 140px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-2);
}
.row-status.s-completed { color: var(--status-completed); }
.row-status.s-planned { color: var(--status-planned); }
.row-status.s-playing { color: var(--status-playing); }
.row-status.s-dropped { color: var(--status-dropped); }
.row-status-icon { font-size: 12px; }

@media (max-width: 640px) {
  .row-genre, .row-rating { display: none; }
}
</style>
