<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICON_NAMES } from '../stores/library'
import { api } from '../utils/api'
import { useSeo } from '../composables/useSeo'
import RatingPicker from '../components/RatingPicker.vue'
import GameCard from '../components/GameCard.vue'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()

const game = ref(null)
const loading = ref(true)
const error = ref(null)
const menuOpen = ref(false)
const lightbox = ref(null) // screenshot url currently shown full-size, or null

// close the status menu on an outside click, Escape also closes the lightbox
function closeMenu() { menuOpen.value = false }
function onKey(e) {
  if (e.key !== 'Escape') return
  menuOpen.value = false
  lightbox.value = null
}
watch(menuOpen, (open) => {
  if (open) setTimeout(() => document.addEventListener('click', closeMenu), 0)
  else document.removeEventListener('click', closeMenu)
})
document.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onKey)
})

const entry = computed(() => (game.value ? library.entryFor(game.value.id) : null))

async function load(id) {
  loading.value = true
  error.value = null
  game.value = null
  try {
    game.value = await api.get('/game-detail', null, { id })
  } catch (e) {
    error.value = e.message === 'not-found' ? t('gameDetail.notFound') : (e.message || t('gameDetail.loadError'))
  } finally {
    loading.value = false
  }
}

function setStatus(status) {
  if (!auth.isAuthed) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  library.upsert(
    { id: game.value.id, title: game.value.title, cover: game.value.cover, rating: game.value.rating, genres: game.value.genres, released: game.value.released },
    status
  )
  menuOpen.value = false
}

function removeFromLibrary() {
  library.remove(game.value.id)
}

function setRating(r) {
  library.rate(game.value.id, r)
}

function setSimilarStatus(sg, status) {
  if (!auth.isAuthed) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  library.upsert(sg, status)
}

onMounted(() => {
  if (!library.loaded && auth.isAuthed) library.fetchAll()
  load(route.params.id)
})
watch(() => route.params.id, (id) => { if (id) load(id) })

useSeo(() => {
  if (!game.value) return null
  const g = game.value
  const descBase = g.summary ? g.summary.slice(0, 155).trim() + (g.summary.length > 155 ? '…' : '') : null
  return {
    title: g.title,
    description: descBase || t('seo.gameDescription', { title: `${g.title}${g.released ? ` (${g.released.slice(0, 4)})` : ''}` }),
    path: `/game/${g.id}`,
    image: g.cover || undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: g.title,
      description: g.summary || undefined,
      image: g.cover || undefined,
      datePublished: g.released || undefined,
      genre: g.genres?.length ? g.genres : undefined,
      gamePlatform: g.platforms?.length ? g.platforms : undefined,
      publisher: g.publishers?.length ? g.publishers.map((name) => ({ '@type': 'Organization', name })) : undefined,
      author: g.developers?.length ? g.developers.map((name) => ({ '@type': 'Organization', name })) : undefined,
      aggregateRating: g.rating
        ? { '@type': 'AggregateRating', ratingValue: g.rating, bestRating: 5, ratingCount: g.ratingCount || 1 }
        : undefined
    }
  }
})
</script>

<template>
  <div class="shell game-detail-view">
    <button class="back-btn" @click="router.back()">
      <AppIcon name="arrow-left" :size="16" :stroke="2.5" /> {{ t('gameDetail.back') }}
    </button>

    <div v-if="loading" class="status-msg loading-msg mono">{{ t('search.loading') }}</div>
    <p v-else-if="error" class="status-msg error-msg">{{ error }}</p>

    <template v-else-if="game">
      <header class="hero" :class="{ 'has-backdrop': game.screenshots?.length }">
        <div v-if="game.screenshots?.[0]" class="hero-backdrop" :style="{ backgroundImage: `url(${game.screenshots[0]})` }" />
        <div class="hero-inner">
          <div class="hero-cover">
            <img v-if="game.cover" :src="game.cover" :alt="game.title" />
            <div v-else class="hero-cover-fallback mono">{{ game.title.slice(0, 2).toUpperCase() }}</div>
          </div>

          <div class="hero-info">
            <p v-if="game.genres?.length" class="hero-genres">
              <span v-for="g in game.genres" :key="g" class="genre-chip mono">{{ g }}</span>
            </p>
            <h1>{{ game.title }}</h1>
            <p class="hero-meta mono">
              <span v-if="game.rating" class="hero-rating">★ {{ game.rating.toFixed(1) }}</span>
              <span v-if="game.ratingCount">{{ t('gameDetail.ratingCount', { count: game.ratingCount }) }}</span>
              <span v-if="game.released">{{ game.released.slice(0, 4) }}</span>
            </p>

            <div class="hero-controls">
              <div class="badge-wrap">
                <button
                  class="status-badge"
                  :class="[entry?.status ? `s-${entry.status}` : 'unset']"
                  :aria-expanded="menuOpen"
                  @click.stop="auth.isAuthed ? (menuOpen = !menuOpen) : setStatus('planned')"
                >
                  <AppIcon v-if="entry?.status" :name="STATUS_ICON_NAMES[entry.status]" :size="17" :stroke="2.75" />
                  <AppIcon v-else name="plus" :size="18" :stroke="2.75" />
                  {{ entry?.status ? t(`status.${entry.status}`) : t('status.add') }}
                </button>

                <transition name="fade-slide">
                  <div v-if="menuOpen" class="status-menu" @click.stop>
                    <button
                      v-for="s in STATUSES"
                      :key="s"
                      class="status-opt"
                      :class="[`s-${s}`, { active: s === entry?.status }]"
                      @click="setStatus(s)"
                    >
                      <span class="dot" />{{ t(`status.${s}`) }}
                    </button>
                    <button v-if="entry" class="status-opt remove-opt" @click="removeFromLibrary(); menuOpen = false">
                      <span class="dot" />{{ t('status.remove') }}
                    </button>
                  </div>
                </transition>
              </div>

              <RatingPicker v-if="entry" :model-value="entry.rating" @update:model-value="setRating" />
            </div>
            <p v-if="!auth.isAuthed" class="signin-hint">{{ t('gameDetail.signInToTrack') }}</p>

            <div v-if="game.developers?.length || game.publishers?.length || game.platforms?.length" class="hero-facts">
              <div v-if="game.developers?.length" class="fact">
                <span class="fact-label mono">{{ t('gameDetail.developer') }}</span>
                <span class="fact-value">{{ game.developers.join(', ') }}</span>
              </div>
              <div v-if="game.publishers?.length" class="fact">
                <span class="fact-label mono">{{ t('gameDetail.publisher') }}</span>
                <span class="fact-value">{{ game.publishers.join(', ') }}</span>
              </div>
              <div v-if="game.platforms?.length" class="fact">
                <span class="fact-label mono">{{ t('gameDetail.platforms') }}</span>
                <span class="fact-value">{{ game.platforms.join(', ') }}</span>
              </div>
            </div>

            <div v-if="game.officialUrl || game.steamUrl" class="hero-links">
              <a v-if="game.steamUrl" :href="game.steamUrl" target="_blank" rel="noopener" class="btn btn-outline link-btn">{{ t('gameDetail.steamPage') }}<AppIcon name="external" :size="15" /></a>
              <a v-if="game.officialUrl" :href="game.officialUrl" target="_blank" rel="noopener" class="btn btn-outline link-btn">{{ t('gameDetail.officialSite') }}<AppIcon name="external" :size="15" /></a>
            </div>
          </div>
        </div>
      </header>

      <section class="summary-section">
        <p class="summary-text">{{ game.summary || t('gameDetail.noSummary') }}</p>
      </section>

      <section v-if="game.screenshots?.length" class="screenshots-section">
        <h2 class="rule-head">{{ t('gameDetail.screenshots') }}<span class="rule-count">{{ String(game.screenshots.length).padStart(2, '0') }}</span></h2>
        <div class="screenshots-strip">
          <button
            v-for="(shot, i) in game.screenshots"
            :key="i"
            class="screenshot-btn"
            @click="lightbox = shot"
            :aria-label="`${game.title} screenshot ${i + 1}`"
          >
            <img :src="shot" :alt="`${game.title} screenshot ${i + 1}`" loading="lazy" />
          </button>
        </div>
      </section>

      <section v-if="game.similarGames?.length" class="similar-section">
        <h2 class="rule-head">{{ t('gameDetail.similar') }}</h2>
        <div class="game-grid">
          <GameCard
            v-for="sg in game.similarGames"
            :key="sg.id"
            :game="sg"
            :status="library.entryFor(sg.id)?.status"
            :user-rating="library.entryFor(sg.id)?.rating"
            @set-status="(s) => setSimilarStatus(sg, s)"
            @set-rating="(r) => library.rate(sg.id, r)"
            @remove="library.remove(sg.id)"
          />
        </div>
      </section>
    </template>

    <transition name="fade-slide">
      <div v-if="lightbox" class="lightbox" @click="lightbox = null">
        <button class="icon-btn lightbox-close" :aria-label="t('myGames.randomClose')"><AppIcon name="x" :size="18" /></button>
        <img :src="lightbox" alt="" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.game-detail-view { padding: 0 0 40px; }

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px 0 8px;
  background: transparent;
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 20px;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}
.back-btn:hover { color: var(--text-0); border-color: var(--paper); }

.status-msg { text-align: center; padding: 80px 0; color: var(--text-2); }

/* --- hero: cover on the left, the back-of-the-box spec sheet on the right --- */
.hero {
  position: relative;
  overflow: hidden;
  padding: 32px;
  margin-bottom: 40px;
  border: var(--stroke) solid var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-1);
}
.hero-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 30%;
  opacity: 0.32;
  filter: saturate(1.1) contrast(1.05);
  -webkit-mask-image: linear-gradient(100deg, transparent 10%, rgba(0, 0, 0, 0.9) 60%, #000);
  mask-image: linear-gradient(100deg, transparent 10%, rgba(0, 0, 0, 0.9) 60%, #000);
}
.hero.has-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 1px 1px, rgba(12, 12, 14, 0.5) 1px, transparent 0) 0 0 / 4px 4px;
  pointer-events: none;
}
.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 36px;
  align-items: flex-start;
}
.hero-cover {
  flex-shrink: 0;
  width: 220px;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-2);
  border: var(--stroke) solid var(--paper);
  box-shadow: 8px 8px 0 var(--acid);
  transform: rotate(-1.5deg);
}
.hero-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 800;
  color: var(--text-2);
}
.hero-info { min-width: 0; flex: 1; }
.hero-genres { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
.genre-chip {
  padding: 4px 8px 3px;
  border: 1.5px solid var(--line-strong);
  border-radius: 2px;
  background: rgba(12, 12, 14, 0.6);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-1);
}
.hero-info h1 {
  font-size: clamp(28px, 4.2vw, 52px);
  font-weight: 800;
  letter-spacing: -0.035em;
  margin: 0 0 12px;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
}
.hero-meta {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--text-1);
  flex-wrap: wrap;
}
.hero-meta > span + span::before {
  content: '/';
  margin: 0 10px;
  color: var(--line-strong);
}
.hero-rating {
  color: var(--ink);
  background: var(--acid);
  padding: 2px 7px;
  border-radius: 2px;
  font-weight: 700;
}

.hero-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.signin-hint { font-size: 13px; color: var(--text-2); margin: 10px 0 0; }

.badge-wrap { position: relative; }
.status-badge {
  --tone: var(--acid);
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 48px;
  padding: 0 20px 0 16px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid var(--tone);
  background: var(--tone);
  color: var(--ink);
  font-size: 15px;
  font-weight: 800;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.status-badge:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 var(--paper); }
.status-badge:active { transform: none; box-shadow: none; }
.status-badge.s-completed { --tone: var(--st-completed); }
.status-badge.s-planned { --tone: var(--st-planned); }
.status-badge.s-playing { --tone: var(--st-playing); }
.status-badge.s-dropped { --tone: var(--st-dropped); }

.status-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--bg-1);
  border: var(--stroke) solid var(--paper);
  border-radius: var(--radius-md);
  box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
  padding: 5px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
}
.status-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.status-opt:hover { background: var(--bg-3); color: var(--text-0); }
.status-opt.active { color: var(--text-0); box-shadow: inset 3px 0 0 var(--acid); }
.remove-opt { color: var(--st-dropped); border-top: 1px dashed var(--line-strong); border-radius: 0 0 var(--radius-sm) var(--radius-sm); margin-top: 3px; }
.remove-opt .dot { background: var(--st-dropped); }

.hero-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0;
  margin-top: 26px;
  max-width: 560px;
  border-top: var(--stroke) solid var(--line-strong);
}
.fact { display: contents; }
.fact-label,
.fact-value {
  padding: 10px 0;
  border-bottom: 1px dashed var(--line-strong);
  font-size: 13px;
}
.fact-label {
  padding-right: 22px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  align-self: stretch;
  display: flex;
  align-items: center;
}
.fact-value { color: var(--text-0); font-weight: 500; }

.hero-links { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.link-btn { font-size: 13px; }

.summary-section {
  max-width: 760px;
  margin-bottom: 48px;
  padding-left: 22px;
  border-left: 4px solid var(--acid);
}
.summary-text { font-size: 17px; line-height: 1.7; color: var(--text-1); white-space: pre-wrap; margin: 0; }

.screenshots-section, .similar-section { margin-bottom: 48px; }

.screenshots-strip {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 0 8px 14px 0;
  scroll-snap-type: x mandatory;
}
.screenshot-btn {
  flex-shrink: 0;
  width: 300px;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: var(--stroke) solid var(--line-strong);
  padding: 0;
  cursor: zoom-in;
  background: var(--bg-2);
  scroll-snap-align: start;
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast), box-shadow var(--dur-fast) var(--ease-out);
}
.screenshot-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
.screenshot-btn:hover { transform: translate(-3px, -3px); border-color: var(--acid); box-shadow: 5px 5px 0 var(--acid); }

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(8, 8, 10, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  cursor: zoom-out;
}
.lightbox img { max-width: 100%; max-height: 100%; border: var(--stroke) solid var(--paper); border-radius: var(--radius-md); }
.lightbox-close { position: absolute; top: 16px; right: 16px; }

@media (max-width: 760px) {
  .hero { padding: 22px 18px; }
  .hero-inner { flex-direction: column; align-items: center; gap: 28px; }
  .hero-info { width: 100%; }
  .hero-cover { width: 170px; box-shadow: 6px 6px 0 var(--acid); }
  .hero-backdrop { -webkit-mask-image: linear-gradient(180deg, #000, transparent 70%); mask-image: linear-gradient(180deg, #000, transparent 70%); }
  .screenshot-btn { width: 240px; }
  .summary-text { font-size: 16px; }
  .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
}
</style>
