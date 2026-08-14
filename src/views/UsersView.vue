<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { api } from '../utils/api'

const { t } = useI18n()
const auth = useAuthStore()

const users = ref([])
const loading = ref(true)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await api.get('/users-list', auth.token)
    users.value = res.users || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase()
}

onMounted(load)
</script>

<template>
  <div class="shell users-view">
    <header class="users-header">
      <p class="eyebrow mono">{{ t('users.eyebrow') }}</p>
      <h1>{{ t('users.title') }}</h1>
      <p class="subtitle">{{ t('users.subtitle') }}</p>
    </header>

    <div v-if="loading" class="status-msg">{{ t('search.loading') }}</div>
    <p v-else-if="error" class="status-msg error-msg">{{ error }}</p>
    <p v-else-if="!users.length" class="status-msg">{{ t('users.empty') }}</p>

    <div v-else class="users-grid">
      <router-link
        v-for="u in users"
        :key="u.username"
        :to="{ name: 'user-profile', params: { username: u.username } }"
        class="user-card"
      >
        <div class="user-avatar">
          <img v-if="u.avatar" :src="u.avatar" :alt="u.username" />
          <span v-else class="user-avatar-fallback mono">{{ initials(u.username) }}</span>
        </div>
        <div class="user-info">
          <span class="user-name">{{ u.username }}</span>
          <span class="user-count mono">{{ t('users.gameCount', { count: u.gameCount }) }}</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.users-view { padding-bottom: 60px; }
.users-header { padding: 24px 0 32px; }
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-amber);
  margin: 0 0 8px;
}
.users-header h1 { font-size: clamp(24px, 3.4vw, 32px); margin: 0; }
.subtitle { color: var(--text-2); margin: 8px 0 0; font-size: 14px; }

.status-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  text-decoration: none;
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast);
}
.user-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }

.user-avatar {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.user-avatar-fallback { font-size: 14px; font-weight: 700; color: var(--text-2); }

.user-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.user-name { font-size: 14px; font-weight: 600; color: var(--text-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-count { font-size: 12px; color: var(--text-2); }
</style>
