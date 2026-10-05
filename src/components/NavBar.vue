<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { useSteamPlaytimeStore } from '../stores/steamPlaytime'
import { useDealsStore } from '../stores/deals'
import { useCommentsStore } from '../stores/comments'
import LangSwitcher from './LangSwitcher.vue'
import AppIcon from './AppIcon.vue'
import logoIconUrl from '../assets/logo-icon.svg'
import logoWordmarkUrl from '../assets/logo-wordmark.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const library = useLibraryStore()
const steamPlaytime = useSteamPlaytimeStore()
const deals = useDealsStore()
const comments = useCommentsStore()
const mobileOpen = ref(false)

watch(() => route.fullPath, () => { mobileOpen.value = false })

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
  comments.reset()
  mobileOpen.value = false
  router.push({ name: 'library' })
}
</script>

<template>
  <header class="nav" :class="{ open: mobileOpen }">
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
        <router-link v-if="auth.isAuthed" :to="{ name: 'users' }" class="tab" :class="{ active: route.name === 'users' || route.name === 'user-profile' }">
          {{ t('nav.users') }}
        </router-link>
      </nav>

      <div class="controls">
        <router-link
          :to="{ name: 'donate' }"
          class="coin-btn"
          :class="{ active: route.name === 'donate' }"
          :title="t('nav.donateHint')"
        >
          <span class="coin"><AppIcon name="heart" :size="16" :stroke="2.5" /></span>
          <span class="coin-label">{{ t('nav.donate') }}</span>
        </router-link>

        <span class="divider" aria-hidden="true" />

        <LangSwitcher />
        <template v-if="auth.isAuthed">
          <router-link :to="{ name: 'account' }" class="user-chip" :class="{ active: route.name === 'account' }">
            <img v-if="auth.user?.avatar" :src="auth.user.avatar" alt="" class="user-avatar" />
            <span v-else class="user-avatar user-avatar-fallback mono">{{ auth.user?.username?.slice(0, 1).toUpperCase() }}</span>
            <span class="user-name">{{ auth.user?.username }}</span>
          </router-link>
          <button class="icon-btn logout-btn" @click="logout" :aria-label="t('nav.logout')" :title="t('nav.logout')">
            <AppIcon name="log-out" :size="17" />
          </button>
        </template>
        <template v-else>
          <a href="/api/auth-steam-start" class="steam-icon-btn" :aria-label="t('auth.steamCta')" :title="t('auth.steamCta')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.99 2 2.87 5.8 2.14 10.73l5.15 2.13a2.7 2.7 0 0 1 1.53-.47c.05 0 .1 0 .15.01l2.29-3.32v-.05a3.65 3.65 0 1 1 3.65 3.65h-.08l-3.27 2.33v.13a2.7 2.7 0 0 1-4.34 2.14L2.5 15.8C3.79 19.42 7.6 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2ZM8.3 17.5l-1.18-.49a1.98 1.98 0 0 0 1.02.9 2.02 2.02 0 0 0 2.63-1.1 2 2 0 0 0-1.09-2.62 2 2 0 0 0-1.52-.01l1.22.5a1.47 1.47 0 1 1-1.08 2.72v.1Zm7.65-6.34a2.44 2.44 0 1 1 0-4.87 2.44 2.44 0 0 1 0 4.87Zm0-.73a1.7 1.7 0 1 0 0-3.41 1.7 1.7 0 0 0 0 3.41Z" />
            </svg>
          </a>
          <router-link :to="{ name: 'login' }" class="btn btn-ghost">{{ t('nav.login') }}</router-link>
          <router-link :to="{ name: 'register' }" class="btn btn-primary">{{ t('nav.register') }}</router-link>
        </template>
      </div>

      <div class="mobile-actions">
        <router-link
          :to="{ name: 'donate' }"
          class="coin-btn coin-btn-compact"
          :title="t('nav.donateHint')"
          :aria-label="t('nav.donate')"
        >
          <span class="coin"><AppIcon name="heart" :size="16" :stroke="2.5" /></span>
        </router-link>
        <button class="burger" @click="mobileOpen = !mobileOpen" :aria-expanded="mobileOpen" aria-label="menu">
          <span /><span /><span />
        </button>
      </div>
    </div>

    <transition name="fade-slide">
      <div v-if="mobileOpen" class="mobile-panel">
        <div class="shell mobile-inner">
          <router-link :to="{ name: 'library' }" class="m-link" @click="mobileOpen = false">
            <span>{{ t('nav.library') }}</span><AppIcon name="arrow-right" :size="18" />
          </router-link>
          <router-link :to="{ name: 'my-games' }" class="m-link" @click="mobileOpen = false">
            <span>{{ t('nav.myGames') }}</span><AppIcon name="arrow-right" :size="18" />
          </router-link>
          <router-link v-if="auth.isAuthed" :to="{ name: 'users' }" class="m-link" @click="mobileOpen = false">
            <span>{{ t('nav.users') }}</span><AppIcon name="arrow-right" :size="18" />
          </router-link>
          <router-link v-if="auth.isAuthed" :to="{ name: 'account' }" class="m-link" @click="mobileOpen = false">
            <span>{{ t('nav.profile') }}</span><AppIcon name="arrow-right" :size="18" />
          </router-link>

          <router-link :to="{ name: 'donate' }" class="m-donate" @click="mobileOpen = false">
            <span class="coin"><AppIcon name="heart" :size="18" :stroke="2.5" /></span>
            <span class="m-donate-text">
              <strong>{{ t('nav.donate') }}</strong>
              <small>{{ t('nav.donateHint') }}</small>
            </span>
          </router-link>

          <div class="mobile-controls">
            <LangSwitcher />
            <button v-if="auth.isAuthed" class="btn btn-outline" @click="logout">
              <AppIcon name="log-out" :size="16" />{{ t('nav.logout') }}
            </button>
            <a v-else href="/api/auth-steam-start" class="btn btn-steam-mobile" @click="mobileOpen = false">{{ t('auth.steamCta') }}</a>
          </div>
          <div v-if="!auth.isAuthed" class="mobile-auth">
            <router-link :to="{ name: 'login' }" class="btn btn-outline" @click="mobileOpen = false">{{ t('nav.login') }}</router-link>
            <router-link :to="{ name: 'register' }" class="btn btn-primary" @click="mobileOpen = false">{{ t('nav.register') }}</router-link>
          </div>
        </div>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--bg-0) 86%, transparent);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  border-bottom: var(--stroke) solid var(--line);
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
  gap: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: 4px;
}
.brand-icon {
  height: 30px;
  width: auto;
  display: block;
  flex-shrink: 0;
  transition: transform var(--dur-med) var(--ease-spring);
}
.brand:hover .brand-icon { transform: rotate(-6deg) scale(1.06); }
.brand-word {
  height: 18px;
  width: auto;
  display: block;
}

.tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.tab {
  position: relative;
  text-decoration: none;
  color: var(--text-1);
  font-weight: 600;
  font-size: 14px;
  height: 38px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: color var(--dur-fast), background var(--dur-fast), border-color var(--dur-fast);
}
.tab:hover { color: var(--text-0); border-color: var(--line-strong); }
.tab.active {
  color: var(--ink);
  background: var(--acid);
  border-color: var(--acid);
}
.tab-count {
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--bg-3);
  color: var(--text-0);
}
.tab.active .tab-count { background: var(--ink); color: var(--acid); }

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.divider {
  width: 2px;
  height: 22px;
  background: var(--line);
  margin: 0 2px;
}

/* --- donate: an orange pill, the only round control on the bar --- */
.coin-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 16px 0 5px;
  border-radius: 999px;
  border: var(--stroke) solid var(--hot);
  background: var(--hot);
  color: var(--ink);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.01em;
  text-decoration: none;
  white-space: nowrap;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.coin-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 var(--paper);
}
.coin-btn:active { transform: none; box-shadow: none; }
.coin-btn.active { box-shadow: 3px 3px 0 var(--paper); }
.coin {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--hot);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.coin-btn:hover .coin { animation: heart-beat 0.8s var(--ease-out); }
@keyframes heart-beat {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.18); }
  50% { transform: scale(0.95); }
  70% { transform: scale(1.1); }
}
.coin-btn-compact { padding: 0; width: 40px; justify-content: center; }

.user-chip {
  height: 40px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
  padding: 0 12px 0 4px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid var(--line);
  background: var(--bg-1);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.user-chip:hover, .user-chip.active { border-color: var(--paper); background: var(--bg-2); }
.user-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 3px;
  flex-shrink: 0;
  object-fit: cover;
}
.user-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--acid);
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}
.logout-btn { width: 40px; height: 40px; }

.steam-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid #2a475e;
  background: #1b2838;
  color: #c7d5e0;
  flex-shrink: 0;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}
.steam-icon-btn:hover { color: #fff; border-color: #66c0f4; }

.mobile-actions { display: none; }
.mobile-panel { display: none; }

@media (max-width: 1180px) {
  .coin-label { display: none; }
  .coin-btn { padding: 0; width: 40px; justify-content: center; }
  .user-name { display: none; }
  .user-chip { padding: 0 4px; }
}

@media (max-width: 860px) {
  .tabs, .controls { display: none; }
  .mobile-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }
  .burger {
    width: 44px;
    height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    background: var(--bg-1);
    border: var(--stroke) solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 0;
  }
  .burger span {
    width: 18px;
    height: 2px;
    background: var(--text-0);
    transition: transform var(--dur-med) var(--ease-out), opacity var(--dur-fast);
  }
  .nav.open .burger { border-color: var(--acid); }
  .nav.open .burger span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .nav.open .burger span:nth-child(2) { opacity: 0; }
  .nav.open .burger span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  .mobile-panel {
    display: block;
    border-top: var(--stroke) solid var(--line);
    background: var(--bg-0);
    max-height: calc(100vh - var(--nav-h));
    overflow-y: auto;
  }
  .mobile-inner {
    display: flex;
    flex-direction: column;
    padding-top: 6px;
    padding-bottom: 22px;
  }
  .m-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    text-decoration: none;
    color: var(--text-0);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.01em;
    border-bottom: 1px dashed var(--line-strong);
  }
  .m-link.router-link-exact-active { color: var(--acid); }
  .m-donate {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 18px 0 14px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--hot);
    color: var(--ink);
    text-decoration: none;
  }
  .m-donate .coin { width: 38px; height: 38px; }
  .m-donate-text { display: flex; flex-direction: column; gap: 1px; }
  .m-donate-text strong { font-size: 15px; font-weight: 800; }
  .m-donate-text small { font-size: 12px; font-weight: 600; opacity: 0.8; }
  .mobile-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mobile-controls .btn { flex: 1; }
  .mobile-auth {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
  }
  .btn-steam-mobile {
    background: #1b2838;
    border-color: #2a475e;
    color: #c7d5e0;
  }
}

@media (max-width: 380px) {
  .brand-word { height: 15px; }
}
</style>
