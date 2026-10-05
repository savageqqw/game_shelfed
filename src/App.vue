<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from './components/NavBar.vue'
import AppBackground from './components/AppBackground.vue'
import AppIcon from './components/AppIcon.vue'
import { STATUSES, useLibraryStore } from './stores/library'
import { useAuthStore } from './stores/auth'
import { useDealsStore } from './stores/deals'
import { useCommentsStore } from './stores/comments'
import { useSteamPlaytimeStore } from './stores/steamPlaytime'
import { usePageViewsStore } from './stores/pageViews'
import { useI18n } from 'vue-i18n'
import logoIconUrl from './assets/logo-icon.svg'
import logoWordmarkUrl from './assets/logo-wordmark.svg'
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const deals = useDealsStore()
const comments = useCommentsStore()
const steamPlaytime = useSteamPlaytimeStore()
const pageViews = usePageViewsStore()

// the server rejected the stored token: sign out and send the person to
// the login page, returning them here afterwards
async function onSessionExpired() {
  if (!auth.isAuthed) return
  auth.logout()
  library.reset()
  deals.reset()
  comments.reset()
  steamPlaytime.reset()
  // the first failing request can fire before the initial navigation settles
  await router.isReady()
  const current = router.currentRoute.value
  if (current.meta.requiresAuth) router.push({ name: 'login', query: { redirect: current.fullPath } })
}

onMounted(() => {
  pageViews.trackAndLoad()
  window.addEventListener('gs:session-expired', onSessionExpired)
})
onBeforeUnmount(() => window.removeEventListener('gs:session-expired', onSessionExpired))
</script>

<template>
  <AppBackground />
  <div class="app-shell">
    <NavBar />

    <div v-if="deals.deals.length && !deals.dismissed" class="deals-banner">
      <div class="shell deals-banner-row">
        <span class="deals-flag mono"><AppIcon name="flame" :size="15" />SALE</span>
        <p class="deals-text">
          {{ t('deals.bannerPrefix', { count: deals.deals.length, threshold: deals.threshold }) }}
          <span class="deals-list">
            <span v-for="(d, i) in deals.deals.slice(0, 4)" :key="d.game_id" class="deals-item">
              {{ d.title }} <b class="mono">-{{ d.discountPercent }}%</b><template v-if="i < Math.min(deals.deals.length, 4) - 1">, </template>
            </span>
            <span v-if="deals.deals.length > 4">{{ t('deals.andMore', { count: deals.deals.length - 4 }) }}</span>
          </span>
        </p>
        <button class="deals-close" @click="deals.dismiss()" :aria-label="t('deals.dismiss')">
          <AppIcon name="x" :size="16" />
        </button>
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
          <li v-for="s in STATUSES" :key="s" class="legend-item" :class="`s-${s}`">
            <span class="dot" />{{ t(`status.${s}`) }}
          </li>
        </ul>
        <div class="receipt">
          <div class="barcode" aria-hidden="true">
            <span v-for="n in 34" :key="n" />
          </div>
          <span class="receipt-code mono">GSHELF · 000 · UA</span>
          <span v-if="pageViews.weekly" class="view-counter mono">
            <AppIcon name="eye" :size="13" /> {{ t('footer.weeklyVisitors', { count: pageViews.weekly }) }}
          </span>
          <router-link :to="{ name: 'donate' }" class="footer-donate mono">
            <AppIcon name="heart" :size="13" />{{ t('nav.donate') }}
          </router-link>
        </div>
      </div>
      <div class="footer-mark" aria-hidden="true">GAME&nbsp;SHELFED</div>
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
  padding-top: 28px;
}

/* --- deals banner: a strip of sale-sticker orange under the nav --- */
.deals-banner {
  background: var(--hot);
  color: var(--ink);
  border-bottom: var(--stroke) solid var(--ink);
}
.deals-banner-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 44px;
}
.deals-flag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background: var(--ink);
  color: var(--hot);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  border-radius: 2px;
  transform: rotate(-2deg);
}
.deals-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deals-item b { font-weight: 800; }
.deals-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid transparent;
  background: transparent;
  color: var(--ink);
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.deals-close:hover { border-color: var(--ink); background: rgba(0, 0, 0, 0.08); }

/* --- footer: receipt strip + an oversized outlined wordmark --- */
.app-footer {
  position: relative;
  border-top: var(--stroke) solid var(--line);
  margin-top: 80px;
  padding-top: 36px;
  overflow: hidden;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.35));
}
.footer-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 28px;
}
.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
}
.footer-brand-row {
  display: flex;
  align-items: center;
  gap: 9px;
}
.footer-icon {
  height: 26px;
  width: auto;
  display: block;
  flex-shrink: 0;
}
.footer-logo {
  height: 16px;
  width: auto;
  display: block;
}
.tagline {
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.5;
}
.legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  max-width: 420px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.receipt {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.receipt .barcode {
  height: 30px;
  opacity: 0.85;
}
.receipt-code {
  font-size: 11px;
  color: var(--text-2);
  letter-spacing: 0.2em;
}
.view-counter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-1);
  letter-spacing: 0.04em;
}
.view-counter :deep(svg) { color: var(--acid); }
.footer-donate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hot);
  text-decoration: none;
  border-bottom: 1.5px solid transparent;
  transition: border-color var(--dur-fast);
}
.footer-donate:hover { border-bottom-color: var(--hot); }

.footer-mark {
  margin-top: 36px;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(56px, 13.5vw, 210px);
  line-height: 0.78;
  letter-spacing: -0.04em;
  white-space: nowrap;
  text-align: center;
  color: transparent;
  -webkit-text-stroke: 1.5px var(--line-strong);
  transform: translateY(14%);
  user-select: none;
  pointer-events: none;
}

@media (max-width: 700px) {
  .receipt { align-items: flex-start; }
  .deals-flag { display: none; }
}
</style>
