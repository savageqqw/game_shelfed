<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore, STATUSES, STATUS_ICONS } from '../stores/library'
import { api } from '../utils/api'
import RatingPicker from '../components/RatingPicker.vue'
import GameCard from '../components/GameCard.vue'

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
</script>

<template>
  <div class="shell game-detail-view">
    <button class="back-btn" @click="router.back()">
      <span aria-hidden="true">←</span> {{ t('gameDetail.back') }}
    </button>

    <div v-if="loading" class="status-msg loading-msg mono">{{ t('search.loading') }}</div>
    <p v-else-if="error" class="status-msg error-msg">{{ error }}</p>

    <template v-else-if="game">
      <header class="hero card-surface" :class="{ 'has-backdrop': game.screenshots?.length }">
        <div v-if="game.screenshots?.[0]" class="hero-backdrop" :style="{ backgroundImage: `url(${game.screenshots[0]})` }" />
        <div class="hero-inner">
          <div class="hero-cover">
            <img v-if="game.cover" :src="game.cover" :alt="game.title" />
            <div v-else class="hero-cover-fallback mono">{{ game.title.slice(0, 2).toUpperCase() }}</div>
          </div>

          <div class="hero-info">
            <h1>{{ game.title }}</h1>
            <p class="hero-meta">
              <span v-if="game.rating" class="hero-rating mono">★ {{ game.rating.toFixed(1) }}</span>
              <span v-if="game.ratingCount" class="mono">{{ t('gameDetail.ratingCount', { count: game.ratingCount }) }}</span>
              <span v-if="game.released" class="mono">{{ game.released.slice(0, 4) }}</span>
            </p>
            <p v-if="game.genres?.length" class="hero-genres">{{ game.genres.join(' · ') }}</p>

            <div class="hero-controls">
              <div class="badge-wrap">
                <button
                  class="status-badge"
                  :class="[entry?.status ? `s-${entry.status}` : 'unset']"
                  @click.stop="auth.isAuthed ? (menuOpen = !menuOpen) : setStatus('planned')"
                >
                  <span v-if="entry?.status" class="badge-icon mono">{{ STATUS_ICONS[entry.status] }}</span>
                  <span v-else class="badge-plus">+</span>
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
              <a v-if="game.steamUrl" :href="game.steamUrl" target="_blank" rel="noopener" class="btn btn-ghost link-btn">{{ t('gameDetail.steamPage') }}</a>
              <a v-if="game.officialUrl" :href="game.officialUrl" target="_blank" rel="noopener" class="btn btn-ghost link-btn">{{ t('gameDetail.officialSite') }}</a>
            </div>
          </div>
        </div>
      </header>

      <section class="summary-section">
        <p class="summary-text">{{ game.summary || t('gameDetail.noSummary') }}</p>
      </section>

      <section v-if="game.screenshots?.length" class="screenshots-section">
        <h2>{{ t('gameDetail.screenshots') }}</h2>
        <div class="screenshots-strip">
          <button
            v-for="(shot, i) in game.screenshots"
            :key="i"
            class="screenshot-btn"
            @click="lightbox = shot"
          >
            <img :src="shot" :alt="`${game.title} screenshot ${i + 1}`" loading="lazy" />
          </button>
        </div>
      </section>

      <section v-if="game.similarGames?.length" class="similar-section">
        <h2>{{ t('gameDetail.similar') }}</h2>
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
        <img :src="lightbox" alt="" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.game-detail-view { padding: 24px 0 60px; }

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 16px;
  transition: color var(--dur-fast);
}
.back-btn:hover { color: var(--text-0); }

.status-msg { text-align: center; padding: 80px 0; color: var(--text-2); }

.hero {
  position: relative;
  overflow: hidden;
  padding: 28px;
  margin-bottom: 32px;
}
.hero-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.22;
  filter: blur(2px) saturate(1.1);
  -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.9), transparent 85%);
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.9), transparent 85%);
}
.hero-inner {
  position: relative;
  display: flex;
  gap: 28px;
  align-items: flex-start;
}
.hero-cover {
  flex-shrink: 0;
  width: 180px;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-2);
  box-shadow: 0 16px 32px -14px rgba(0, 0, 0, 0.5);
}
.hero-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  color: var(--text-2);
}
.hero-info { min-width: 0; flex: 1; }
.hero-info h1 { font-size: clamp(22px, 3.4vw, 32px); margin: 0 0 8px; }
.hero-meta { display: flex; align-items: center; gap: 14px; margin: 0 0 6px; font-size: 13px; color: var(--text-2); flex-wrap: wrap; }
.hero-rating { color: var(--accent-amber); font-weight: 700; }
.hero-genres { color: var(--text-1); font-size: 13px; margin: 0 0 18px; }

.hero-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
.signin-hint { font-size: 12px; color: var(--text-2); margin: 8px 0 0; }

.badge-wrap { position: relative; }
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-2);
  color: var(--text-0);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--dur-fast), border-color var(--dur-fast);
}
.status-badge:hover { background: var(--bg-3); }
.status-badge.s-completed { border-color: var(--status-completed); color: var(--status-completed); }
.status-badge.s-planned { border-color: var(--status-planned); color: var(--status-planned); }
.status-badge.s-playing { border-color: var(--status-playing); color: var(--status-playing); }
.status-badge.s-dropped { border-color: var(--status-dropped); color: var(--status-dropped); }
.badge-plus { font-size: 15px; line-height: 1; }
.badge-icon { font-size: 12px; }

.status-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  padding: 6px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
}
.status-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast);
}
.status-opt:hover { background: var(--bg-2); }
.status-opt.active { color: var(--text-0); }
.status-opt .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--text-2); }
.status-opt.s-completed .dot { background: var(--status-completed); }
.status-opt.s-planned .dot { background: var(--status-planned); }
.status-opt.s-playing .dot { background: var(--status-playing); }
.status-opt.s-dropped .dot { background: var(--status-dropped); }
.remove-opt { color: var(--status-dropped); border-top: 1px solid var(--border-soft); margin-top: 2px; padding-top: 8px; }
.remove-opt .dot { background: var(--status-dropped); }

.hero-facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border-soft);
  max-width: 460px;
}
.fact { display: flex; gap: 10px; font-size: 13px; }
.fact-label { flex-shrink: 0; width: 100px; color: var(--text-2); }
.fact-value { color: var(--text-1); }

.hero-links { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.link-btn { font-size: 13px; padding: 9px 16px; text-decoration: none; }

.summary-section { max-width: 720px; margin-bottom: 36px; }
.summary-text { font-size: 15px; line-height: 1.7; color: var(--text-1); white-space: pre-wrap; }

.screenshots-section, .similar-section { margin-bottom: 40px; }
.screenshots-section h2, .similar-section h2 { font-size: 18px; margin: 0 0 16px; }

.screenshots-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.screenshot-btn {
  flex-shrink: 0;
  width: 260px;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: none;
  padding: 0;
  cursor: pointer;
  background: var(--bg-2);
}
.screenshot-btn img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--dur-med) var(--ease-out); }
.screenshot-btn:hover img { transform: scale(1.05); }

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(10, 11, 16, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  cursor: zoom-out;
}
.lightbox img { max-width: 100%; max-height: 100%; border-radius: var(--radius-md); box-shadow: 0 20px 60px -20px rgba(0,0,0,0.7); }

@media (max-width: 640px) {
  .hero-inner { flex-direction: column; align-items: center; text-align: center; }
  .hero-cover { width: 140px; }
  .hero-meta, .hero-controls { justify-content: center; }
  .hero-facts { margin-left: auto; margin-right: auto; text-align: left; }
  .screenshot-btn { width: 200px; }
}
</style>
