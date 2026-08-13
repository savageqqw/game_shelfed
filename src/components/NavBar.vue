<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { useSteamPlaytimeStore } from '../stores/steamPlaytime'
import { useDealsStore } from '../stores/deals'
import ThemeToggle from './ThemeToggle.vue'
import LangSwitcher from './LangSwitcher.vue'
import logoIconUrl from '../assets/logo-icon.svg'
import logoWordmarkUrl from '../assets/logo-wordmark.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const library = useLibraryStore()
const steamPlaytime = useSteamPlaytimeStore()
const deals = useDealsStore()
const mobileOpen = ref(false)

// Kick this off as soon as the app shell mounts (present on every page),
// well before the person ever opens My Games, so by the time they click
// that tab the data is usually already sitting in the store.
if (auth.isAuthed) {
  steamPlaytime.ensureLoaded()
  deals.ensureChecked()
}
watch(() => auth.isAuthed, (v) => {
  if (v) {
    steamPlaytime.ensureLoaded()
    deals.ensureChecked()
  }
})

function logout() {
  auth.logout()
  library.reset()
  steamPlaytime.reset()
  deals.reset()
  mobileOpen.value = false
  router.push({ name: 'library' })
}
</script>

<template>
  <header class="nav">
    <div class="shell nav-row">
      <router-link :to="{ name: 'library' }" class="brand" @click="mobileOpen = false">
        <img :src="logoIconUrl" alt="" class="brand-icon" />
        <img :src="logoWordmarkUrl" alt="Game Shelfed" class="brand-word" />
      </router-link>

      <nav class="tabs" aria-label="primary">
        <router-link :to="{ name: 'library' }" class="tab" :class="{ active: route.name === 'library' }">
          {{ t('nav.library') }}
        </router-link>
        <router-link :to="{ name: 'my-games' }" class="tab" :class="{ active: route.name === 'my-games' }">
          {{ t('nav.myGames') }}
          <span v-if="auth.isAuthed && library.items.length" class="tab-count mono">{{ library.items.length }}</span>
        </router-link>
      </nav>

      <div class="controls">
        <LangSwitcher />
        <ThemeToggle />
        <template v-if="auth.isAuthed">
          <router-link :to="{ name: 'account' }" class="user-chip">
            <img v-if="auth.user?.avatar" :src="auth.user.avatar" alt="" class="user-avatar" />
            {{ auth.user?.username }}
          </router-link>
          <button class="btn btn-ghost" @click="logout">{{ t('nav.logout') }}</button>
        </template>
        <template v-else>
          <a href="/api/auth-steam-start" class="steam-icon-btn" :aria-label="t('auth.steamCta')" :title="t('auth.steamCta')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.99 2 2.87 5.8 2.14 10.73l5.15 2.13a2.7 2.7 0 0 1 1.53-.47c.05 0 .1 0 .15.01l2.29-3.32v-.05a3.65 3.65 0 1 1 3.65 3.65h-.08l-3.27 2.33v.13a2.7 2.7 0 0 1-4.34 2.14L2.5 15.8C3.79 19.42 7.6 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2ZM8.3 17.5l-1.18-.49a1.98 1.98 0 0 0 1.02.9 2.02 2.02 0 0 0 2.63-1.1 2 2 0 0 0-1.09-2.62 2 2 0 0 0-1.52-.01l1.22.5a1.47 1.47 0 1 1-1.08 2.72v.1Zm7.65-6.34a2.44 2.44 0 1 1 0-4.87 2.44 2.44 0 0 1 0 4.87Zm0-.73a1.7 1.7 0 1 0 0-3.41 1.7 1.7 0 0 0 0 3.41Z" />
            </svg>
          </a>
          <router-link :to="{ name: 'login' }" class="btn btn-ghost">{{ t('nav.login') }}</router-link>
          <router-link :to="{ name: 'register' }" class="btn btn-primary">{{ t('nav.register') }}</router-link>
        </template>
      </div>

      <button class="burger" @click="mobileOpen = !mobileOpen" :aria-expanded="mobileOpen" aria-label="menu">
        <span /><span /><span />
      </button>
    </div>

    <transition name="fade-slide">
      <div v-if="mobileOpen" class="mobile-panel shell">
        <router-link :to="{ name: 'library' }" @click="mobileOpen = false">{{ t('nav.library') }}</router-link>
        <router-link :to="{ name: 'my-games' }" @click="mobileOpen = false">{{ t('nav.myGames') }}</router-link>
        <div class="mobile-controls">
          <LangSwitcher />
          <ThemeToggle />
        </div>
        <template v-if="auth.isAuthed">
          <router-link :to="{ name: 'account' }" @click="mobileOpen = false">{{ t('nav.profile') }}</router-link>
          <button class="btn btn-ghost" @click="logout">{{ t('nav.logout') }}</button>
        </template>
        <template v-else>
          <a href="/api/auth-steam-start" class="btn btn-steam-mobile" @click="mobileOpen = false">{{ t('auth.steamCta') }}</a>
          <router-link :to="{ name: 'login' }" class="btn btn-ghost" @click="mobileOpen = false">{{ t('nav.login') }}</router-link>
          <router-link :to="{ name: 'register' }" class="btn btn-primary" @click="mobileOpen = false">{{ t('nav.register') }}</router-link>
        </template>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--bg-0) 88%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border-soft);
}
.nav-row {
  height: var(--nav-h);
  display: flex;
  align-items: center;
  gap: 28px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
  transform: translateY(-2px);
}
.brand-icon {
  height: 30px;
  width: auto;
  display: block;
  flex-shrink: 0;
}
.brand-word {
  height: 19px;
  width: auto;
  display: block;
}

.tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.tab {
  position: relative;
  text-decoration: none;
  color: var(--text-2);
  font-weight: 600;
  font-size: 14px;
  padding: 10px 16px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color var(--dur-fast), background var(--dur-fast);
}
.tab:hover { color: var(--text-0); background: var(--bg-2); }
.tab.active {
  color: var(--text-0);
  background: var(--bg-2);
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 2px;
  background: var(--accent-amber);
  border-radius: 2px;
}
.tab-count {
  font-size: 11px;
  background: var(--bg-3);
  color: var(--text-1);
  padding: 1px 7px;
  border-radius: 999px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-chip {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  padding: 6px 12px 6px 6px;
  border-radius: 999px;
  background: var(--bg-2);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.user-chip:hover { background: var(--bg-3); color: var(--text-0); }
.user-avatar { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; }

.steam-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: #1b2838;
  color: #fdfaf2;
  flex-shrink: 0;
  transition: filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.steam-icon-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }

.btn-steam-mobile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: #1b2838;
  color: #fdfaf2;
  font-weight: 700;
  text-decoration: none;
}

.burger { display: none; }

.mobile-panel {
  display: none;
}

@media (max-width: 860px) {
  .tabs, .controls { display: none; }
  .burger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-left: auto;
    background: none;
    border: none;
    padding: 8px;
  }
  .burger span {
    width: 20px;
    height: 2px;
    background: var(--text-0);
    border-radius: 2px;
  }
  .mobile-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 24px 22px;
    border-top: 1px solid var(--border-soft);
  }
  .mobile-panel a {
    text-decoration: none;
    color: var(--text-1);
    font-weight: 600;
  }
  .mobile-controls {
    display: flex;
    gap: 10px;
    padding: 6px 0;
  }
}
</style>
