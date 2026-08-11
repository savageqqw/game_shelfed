<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()

const failed = ref(false)

onMounted(async () => {
  const { token, id, username, email, avatar, error } = route.query

  if (error || !token) {
    failed.value = true
    return
  }

  auth.setSession(String(token), {
    id: Number(id),
    username: String(username || ''),
    email: String(email || ''),
    avatar: avatar ? String(avatar) : null
  })
  await library.fetchAll()
  router.replace({ name: 'my-games' })
})
</script>

<template>
  <div class="shell callback-view">
    <div v-if="failed" class="callback-card card-surface">
      <p class="callback-msg">{{ t('auth.steamFailed') }}</p>
      <router-link :to="{ name: 'login' }" class="btn btn-primary">{{ t('auth.switchToLogin') }}</router-link>
    </div>
    <p v-else class="callback-loading mono">{{ t('auth.steamConnecting') }}</p>
  </div>
</template>

<style scoped>
.callback-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 40px 20px;
}
.callback-loading { color: var(--text-2); font-size: 14px; }
.callback-card {
  max-width: 380px;
  padding: 32px;
  text-align: center;
}
.callback-msg { color: var(--text-1); margin: 0 0 20px; }
</style>
