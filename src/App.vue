<script setup>
import NavBar from './components/NavBar.vue'
import AppBackground from './components/AppBackground.vue'
import { STATUSES } from './stores/library'
import { useDealsStore } from './stores/deals'
import { useI18n } from 'vue-i18n'
import logoIconUrl from './assets/logo-icon.svg'
import logoWordmarkUrl from './assets/logo-wordmark.svg'
const { t } = useI18n()
const deals = useDealsStore()
</script>

<template>
  <AppBackground />
  <div class="app-shell">
    <NavBar />

    <div v-if="deals.deals.length && !deals.dismissed" class="deals-banner">
      <div class="shell deals-banner-row">
        <p class="deals-text">
          <span aria-hidden="true">🔥</span>
          {{ t('deals.bannerPrefix', { count: deals.deals.length, threshold: deals.threshold }) }}
          <span class="deals-list">
            <span v-for="(d, i) in deals.deals.slice(0, 4)" :key="d.game_id" class="deals-item">
              {{ d.title }} <b>-{{ d.discountPercent }}%</b><template v-if="i < Math.min(deals.deals.length, 4) - 1">, </template>
            </span>
            <span v-if="deals.deals.length > 4">{{ t('deals.andMore', { count: deals.deals.length - 4 }) }}</span>
          </span>
        </p>
        <button class="deals-close" @click="deals.dismiss()" :aria-label="t('deals.dismiss')">✕</button>
      </div>
    </div>

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
          <div class="footer-brand-row">
            <img :src="logoIconUrl" alt="" class="footer-icon" />
            <img :src="logoWordmarkUrl" alt="Game Shelfed" class="footer-logo" />
          </div>
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
.deals-banner {
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-0));
  border-bottom: 1px solid color-mix(in srgb, var(--accent-teal) 35%, transparent);
}
.deals-banner-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
}
.deals-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-1);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deals-list { color: var(--text-0); }
.deals-item b { color: var(--accent-teal); font-weight: 700; }
.deals-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.deals-close:hover { background: var(--bg-2); color: var(--text-0); }
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
.footer-brand-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.footer-icon {
  height: 20px;
  width: auto;
  display: block;
  flex-shrink: 0;
}
.footer-logo {
  height: 15px;
  width: auto;
  display: block;
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
