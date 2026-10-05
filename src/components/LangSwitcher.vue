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
  gap: 7px;
  height: 40px;
  padding: 0 12px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--text-0);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.lang-btn:hover, .lang-btn[aria-expanded='true'] { border-color: var(--paper); background: var(--bg-2); }
.lang-btn svg { transition: transform var(--dur-med) var(--ease-out); }
.lang-btn[aria-expanded='true'] svg { transform: rotate(180deg); }
.lang-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-1);
  border: var(--stroke) solid var(--paper);
  border-radius: var(--radius-md);
  box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
  padding: 4px;
  z-index: 30;
  min-width: 76px;
}
.lang-item {
  display: block;
  width: 100%;
  min-height: 36px;
  text-align: left;
  padding: 0 12px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-1);
}
.lang-item:hover { background: var(--bg-3); color: var(--text-0); }
.lang-item.active { background: var(--acid); color: var(--ink); }
.lang-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

@media (max-width: 860px) {
  .lang-menu { right: auto; left: 0; top: auto; bottom: calc(100% + 8px); }
}
</style>
