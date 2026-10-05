<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useCommentsStore } from '../stores/comments'
import { api } from '../utils/api'
import AppIcon from '../components/AppIcon.vue'

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
  return comments.viewerIsAdmin
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
      <span class="tape">{{ t('users.eyebrow') }}</span>
      <h1>{{ t('users.title') }}<span v-if="users.length" class="title-count mono">{{ users.length }}</span></h1>
    </header>

    <div v-if="!loading && !error && users.length" class="search-wrap">
      <AppIcon name="search" :size="18" class="search-icon" />
      <input
        v-model="searchQuery"
        type="search"
        class="input search-input"
        :placeholder="t('users.searchPlaceholder')"
        :aria-label="t('users.searchPlaceholder')"
      />
      <button
        v-if="searchQuery"
        class="search-clear"
        @click="searchQuery = ''"
        :aria-label="t('myGames.searchClear')"
      ><AppIcon name="x" :size="15" :stroke="2.5" /></button>
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
        <span v-if="u.isAdmin" class="admin-badge">{{ t('users.admin') }}</span>
        <span class="user-count mono">{{ t('users.gameCount', { count: u.gameCount }) }}</span>
        <AppIcon name="arrow-right" :size="16" class="user-arrow" />
      </router-link>
    </div>

    <section class="comments-section">
      <h2 class="rule-head">{{ t('users.comments.title') }}<span v-if="comments.comments.length" class="rule-count">{{ String(comments.comments.length).padStart(2, '0') }}</span></h2>
      <p class="comments-subtitle">{{ t('users.comments.subtitle') }}</p>

      <form class="comment-form" @submit.prevent="submitComment">
        <textarea
          v-model="draft"
          class="input comment-input"
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
          ><AppIcon name="trash" :size="15" /></button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.users-view { padding-bottom: 20px; }
.users-header { padding: 12px 0 30px; }
.users-header h1 {
  margin-top: 18px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: clamp(32px, 4.6vw, 56px);
  font-weight: 800;
  letter-spacing: -0.035em;
}
.title-count {
  margin-top: 0.2em;
  padding: 3px 8px 2px;
  background: var(--acid);
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  border-radius: 2px;
  transform: rotate(-4deg);
}

.search-wrap {
  position: relative;
  margin-bottom: 18px;
  max-width: 420px;
}
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-2);
  pointer-events: none;
}
.search-wrap:focus-within .search-icon { color: var(--acid); }
.search-input { padding-left: 42px; padding-right: 44px; -webkit-appearance: none; appearance: none; }
.search-input::-webkit-search-cancel-button { display: none; }
.search-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-2);
}
.search-clear:hover { background: var(--bg-3); color: var(--text-0); }

.status-msg { color: var(--text-2); text-align: center; padding: 60px 0; }
.error-msg { color: var(--st-dropped); }

.users-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 56px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--text-0);
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast);
}
.user-row:hover {
  transform: translate(-3px, -3px);
  border-color: var(--acid);
  box-shadow: 5px 5px 0 var(--acid);
}

.user-avatar {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.user-avatar-fallback { font-size: 14px; font-weight: 700; color: var(--text-1); }

.user-name {
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.admin-badge {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--acid);
  padding: 3px 6px 2px;
  border-radius: 2px;
}

.user-count { flex-shrink: 0; margin-left: auto; font-size: 12px; color: var(--text-2); }
.user-arrow { color: var(--text-2); transition: transform var(--dur-fast) var(--ease-out), color var(--dur-fast); }
.user-row:hover .user-arrow { color: var(--acid); transform: translateX(3px); }

/* --- comments: a guestbook pinned under the member list --- */
.comments-section { max-width: 820px; }
.comments-subtitle { color: var(--text-1); font-size: 15px; margin: -6px 0 18px; }

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}
.comment-input {
  resize: vertical;
  min-height: 92px;
  line-height: 1.5;
}
.comment-form-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}
.comment-form-row .error-msg { font-size: 13px; margin: 0; margin-right: auto; }

.comment-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 14px 14px 16px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
}
.comment-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.comment-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.comment-avatar-fallback { font-size: 12px; font-weight: 700; color: var(--text-1); }

.comment-body { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; flex-wrap: wrap; }
.comment-author { font-size: 14px; font-weight: 700; color: var(--text-0); }
.comment-date { font-size: 11px; color: var(--text-2); letter-spacing: 0.04em; }
.comment-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-delete {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1.5px solid transparent;
  background: transparent;
  color: var(--text-2);
  transition: border-color var(--dur-fast), color var(--dur-fast);
}
.comment-delete:hover { border-color: var(--st-dropped); color: var(--st-dropped); }

@media (max-width: 560px) {
  .users-list { grid-template-columns: 1fr; }
}
</style>
