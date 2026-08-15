<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useCommentsStore } from '../stores/comments'
import { api } from '../utils/api'

const { t, locale } = useI18n()
const auth = useAuthStore()
const comments = useCommentsStore()

const users = ref([])
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')

const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => u.username.toLowerCase().includes(q))
})

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

// --- comments ---
const draft = ref('')
const commentError = ref(null)

async function submitComment() {
  const body = draft.value.trim()
  if (!body || comments.posting) return
  commentError.value = null
  try {
    await comments.add(body)
    draft.value = ''
  } catch (e) {
    commentError.value = e.message
  }
}

async function deleteComment(id) {
  try {
    await comments.remove(id)
  } catch {
    commentError.value = t('users.comments.deleteError')
  }
}

function canDelete(comment) {
  if (!auth.user) return false
  if (comment.userId === auth.user.id) return true
  return (auth.user.username || '').toLowerCase() === 'hellraiser'
}

function formatDate(raw) {
  if (!raw) return ''
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  load()
  if (!comments.loaded) comments.fetchAll()
})
</script>

<template>
  <div class="shell users-view">
    <header class="users-header">
      <p class="eyebrow mono">{{ t('users.eyebrow') }}</p>
      <h1>{{ t('users.title') }}</h1>
    </header>

    <div v-if="!loading && !error && users.length" class="search-wrap">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="t('users.searchPlaceholder')"
      />
      <button
        v-if="searchQuery"
        class="search-clear"
        @click="searchQuery = ''"
        :aria-label="t('myGames.searchClear')"
      >✕</button>
    </div>

    <div v-if="loading" class="status-msg">{{ t('search.loading') }}</div>
    <p v-else-if="error" class="status-msg error-msg">{{ error }}</p>
    <p v-else-if="!users.length" class="status-msg">{{ t('users.empty') }}</p>
    <p v-else-if="!filteredUsers.length" class="status-msg">{{ t('users.noResults') }}</p>

    <div v-else class="users-list">
      <router-link
        v-for="u in filteredUsers"
        :key="u.username"
        :to="{ name: 'user-profile', params: { username: u.username } }"
        class="user-row"
      >
        <div class="user-avatar">
          <img v-if="u.avatar" :src="u.avatar" :alt="u.username" />
          <span v-else class="user-avatar-fallback mono">{{ initials(u.username) }}</span>
        </div>
        <span class="user-name">{{ u.username }}</span>
        <span v-if="u.isAdmin" class="admin-badge mono">{{ t('users.admin') }}</span>
        <span class="user-count mono">{{ t('users.gameCount', { count: u.gameCount }) }}</span>
      </router-link>
    </div>

    <section class="comments-section">
      <h2>{{ t('users.comments.title') }}</h2>
      <p class="comments-subtitle">{{ t('users.comments.subtitle') }}</p>

      <form class="comment-form" @submit.prevent="submitComment">
        <textarea
          v-model="draft"
          class="comment-input"
          rows="3"
          maxlength="1000"
          :placeholder="t('users.comments.placeholder')"
        />
        <div class="comment-form-row">
          <p v-if="commentError" class="error-msg">{{ commentError }}</p>
          <button class="btn btn-primary" type="submit" :disabled="!draft.trim() || comments.posting">
            {{ comments.posting ? t('users.comments.posting') : t('users.comments.submit') }}
          </button>
        </div>
      </form>

      <div v-if="comments.loading && !comments.loaded" class="status-msg">{{ t('search.loading') }}</div>
      <p v-else-if="!comments.comments.length" class="status-msg">{{ t('users.comments.empty') }}</p>

      <ul v-else class="comment-list">
        <li v-for="c in comments.comments" :key="c.id" class="comment-item">
          <div class="comment-avatar">
            <img v-if="c.avatar" :src="c.avatar" :alt="c.username" />
            <span v-else class="comment-avatar-fallback mono">{{ initials(c.username) }}</span>
          </div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">{{ c.username }}</span>
              <span class="comment-date mono">{{ formatDate(c.createdAt) }}</span>
            </div>
            <p class="comment-text">{{ c.body }}</p>
          </div>
          <button
            v-if="canDelete(c)"
            class="comment-delete"
            @click="deleteComment(c.id)"
            :aria-label="t('users.comments.delete')"
            :title="t('users.comments.delete')"
          >✕</button>
        </li>
      </ul>
    </section>
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

.search-wrap {
  position: relative;
  margin-bottom: 20px;
  max-width: 360px;
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

.status-msg { color: var(--text-2); text-align: center; padding: 60px 0; }

.users-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-soft);
  margin-bottom: 48px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border-soft);
  text-decoration: none;
  transition: background var(--dur-fast);
}
.user-row:hover { background: var(--bg-1); }

.user-avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.user-avatar-fallback { font-size: 13px; font-weight: 700; color: var(--text-2); }

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #17131a;
  background: var(--accent-amber-2);
  padding: 3px 8px;
  border-radius: 999px;
}

.steam-mini-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #66c0f4;
  background: rgba(102, 192, 244, 0.14);
  border: 1px solid rgba(102, 192, 244, 0.3);
}

.user-count { flex-shrink: 0; margin-left: auto; font-size: 12px; color: var(--text-2); }

.comments-section { padding-top: 8px; }
.comments-section h2 { font-size: 18px; margin: 0 0 4px; }
.comments-subtitle { color: var(--text-2); font-size: 13px; margin: 0 0 18px; }

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}
.comment-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  color: var(--text-0);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 72px;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.comment-input::placeholder { color: var(--text-2); }
.comment-input:focus {
  outline: none;
  border-color: var(--accent-amber);
  background: var(--bg-2);
}
.comment-form-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}

.comment-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid var(--border-soft);
}
.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border-soft);
}
.comment-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.comment-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.comment-avatar-fallback { font-size: 12px; font-weight: 700; color: var(--text-2); }

.comment-body { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.comment-author { font-size: 13px; font-weight: 700; color: var(--text-0); }
.comment-date { font-size: 11px; color: var(--text-2); }
.comment-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.comment-delete:hover { background: var(--bg-1); color: var(--status-dropped); }
</style>
