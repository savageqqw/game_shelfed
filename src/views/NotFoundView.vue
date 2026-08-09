<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="shell not-found">
    <p class="code mono">404</p>
    <h1>—</h1>
    <router-link :to="{ name: 'library' }" class="btn btn-primary">{{ t('nav.library') }}</router-link>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
}
.code { font-size: 14px; color: var(--accent-amber-2); letter-spacing: 0.1em; }
</style>
