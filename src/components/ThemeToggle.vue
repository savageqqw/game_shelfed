<script setup>
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '../stores/theme'
const { t } = useI18n()
const theme = useThemeStore()
</script>

<template>
  <button class="toggle" :aria-label="t('theme.toggle')" @click="theme.toggle">
    <span class="track" :class="theme.theme">
      <span class="thumb">
        <svg v-if="theme.theme === 'dark'" viewBox="0 0 24 24" width="12" height="12" fill="none">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none">
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </g>
        </svg>
      </span>
    </span>
  </button>
</template>

<style scoped>
.toggle {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 999px;
}
.track {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  padding: 2px;
  transition: background var(--dur-fast) var(--ease-out);
}
.thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-amber), var(--accent-amber-2));
  color: #241a05;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--dur-med) var(--ease-out);
}
.track.light .thumb {
  transform: translateX(20px);
  background: linear-gradient(135deg, var(--accent-amber), #e2b45a);
}
</style>
