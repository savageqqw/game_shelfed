<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n'

const { locale } = useI18n()
const open = ref(false)
const langs = [
  { code: 'uk', label: 'UA' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' }
]

function pick(code) {
  setLocale(code)
  open.value = false
}
</script>

<template>
  <div class="lang" @keydown.escape="open = false">
    <button class="lang-btn mono" @click="open = !open" :aria-expanded="open">
      {{ langs.find(l => l.code === locale)?.label || 'UA' }}
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
    </button>
    <transition name="fade-slide">
      <div v-if="open" class="lang-menu">
        <button
          v-for="l in langs"
          :key="l.code"
          class="lang-item mono"
          :class="{ active: l.code === locale }"
          @click="pick(l.code)"
        >{{ l.label }}</button>
      </div>
    </transition>
    <div v-if="open" class="lang-backdrop" @click="open = false" />
  </div>
</template>

<style scoped>
.lang { position: relative; }
.lang-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  color: var(--text-1);
  font-size: 12px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 999px;
}
.lang-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  z-index: 30;
  min-width: 64px;
}
.lang-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 14px;
  background: none;
  border: none;
  font-size: 12px;
  color: var(--text-1);
}
.lang-item:hover { background: var(--bg-2); }
.lang-item.active { color: var(--accent-amber-2); font-weight: 700; }
.lang-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}
</style>
