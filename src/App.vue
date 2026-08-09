<script setup>
import NavBar from './components/NavBar.vue'
import AppBackground from './components/AppBackground.vue'
import { STATUSES } from './stores/library'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <AppBackground />
  <div class="app-shell">
    <NavBar />
    <main class="app-main">
      <router-view v-slot="{ Component, route }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
    <footer class="app-footer">
      <div class="shell footer-row">
        <div class="footer-brand">
          <span class="brand-mark">GAME SHELF<em>ed</em></span>
          <span class="tagline">{{ t('footer.tagline') }}</span>
        </div>
        <ul class="legend">
          <li v-for="s in STATUSES" :key="s" class="legend-item">
            <span class="dot" :class="`s-${s}`" />{{ t(`status.${s}`) }}
          </li>
        </ul>
        <div class="receipt">
          <div class="barcode">
            <span v-for="n in 28" :key="n" :style="{ height: 14 + ((n * 7) % 12) + 'px' }" />
          </div>
          <span class="receipt-code mono">GSHELF-000-UA</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-main {
  flex: 1;
  position: relative;
  padding-top: 24px;
}
.app-footer {
  border-top: 1px solid var(--border-soft);
  padding: 28px 0;
  margin-top: 60px;
}
.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
}
.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.brand-mark {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-1);
}
.brand-mark em {
  font-style: normal;
  color: var(--accent-amber-2);
}
.tagline {
  color: var(--text-2);
  font-size: 13px;
}
.legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  padding: 0;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-2);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot.s-completed { background: var(--status-completed); }
.dot.s-planned { background: var(--status-planned); }
.dot.s-playing { background: var(--status-playing); }
.dot.s-dropped { background: var(--status-dropped); }

.receipt {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.receipt .barcode {
  height: 26px;
  align-items: flex-end;
}
.receipt-code {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.06em;
}
</style>
