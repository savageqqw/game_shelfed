<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import ThemeToggle from './ThemeToggle.vue'
import LangSwitcher from './LangSwitcher.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const library = useLibraryStore()
const mobileOpen = ref(false)

function logout() {
  auth.logout()
  library.reset()
  mobileOpen.value = false
  router.push({ name: 'library' })
}
</script>

<template>
  <header class="nav">
    <div class="shell nav-row">
      <router-link :to="{ name: 'library' }" class="brand" @click="mobileOpen = false">
        <svg width="20" height="20" viewBox="0 0 32 32" class="brand-icon" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="var(--accent-amber)" />
          <rect x="8" y="6" width="16" height="20" rx="3" fill="var(--bg-0)" />
          <rect x="12" y="10" width="8" height="4" rx="1.5" fill="var(--accent-amber)" />
          <rect x="12" y="17" width="8" height="3" rx="1.5" fill="var(--accent-violet)" />
        </svg>
        GAME SHELF<em>ed</em>
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
  font-family: var(--font-display);
  font-size: 16px;
  text-decoration: none;
  color: var(--text-0);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.brand em {
  font-style: normal;
  color: var(--accent-amber);
}
.brand-icon { flex-shrink: 0; }

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
