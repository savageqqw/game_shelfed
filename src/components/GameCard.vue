<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUSES, STATUS_ICONS } from '../stores/library'
import RatingPicker from './RatingPicker.vue'

const props = defineProps({
  game: { type: Object, required: true }, // { id, title, cover, rating, released, genres }
  status: { type: String, default: null },
  userRating: { type: String, default: null }, // null | 'like' | 'dislike' | 'mixed'
  showRating: { type: Boolean, default: false }
})
const emit = defineEmits(['set-status', 'remove', 'set-rating'])

const { t } = useI18n()
const menuOpen = ref(false)

function formatPlaytime(minutes) {
  const hours = minutes / 60
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10
  return t('steamImport.hoursPlayed', { hours: rounded })
}

function choose(s) {
  emit('set-status', s)
  menuOpen.value = false
}
</script>

<template>
  <article class="card" :class="{ shelved: !!status }">
    <div class="art">
      <div class="art-media">
        <img v-if="game.cover" :src="game.cover" :alt="game.title" loading="lazy" />
        <div v-else class="art-fallback mono">{{ game.title.slice(0, 2).toUpperCase() }}</div>
        <div class="scrim" />
      </div>

      <button
        v-if="status"
        class="remove-btn"
        @click.stop="emit('remove')"
        :aria-label="t('status.remove')"
      >✕</button>

      <span v-if="game.playtimeMinutes" class="playtime-badge mono">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ formatPlaytime(game.playtimeMinutes) }}
      </span>

      <div class="info">
        <div class="info-row">
          <div class="text-col">
            <h3 class="title">{{ game.title }}</h3>
            <p class="meta">
              <span class="meta-line1">
                <span v-if="game.rating" class="rating mono">★ {{ game.rating.toFixed(1) }}</span>
                <span v-if="game.released" class="mono">{{ game.released.slice(0, 4) }}</span>
              </span>
              <span v-if="game.genres?.length" class="meta-line2">{{ game.genres[0] }}</span>
            </p>
          </div>

          <div v-if="!showRating" class="badge-wrap">
            <button
              class="status-badge"
              :class="status ? `s-${status}` : 'unset'"
              @click.stop="menuOpen = !menuOpen"
              :aria-label="status ? t('status.change') : t('status.add')"
              :title="status ? t(`status.${status}`) : t('status.add')"
            >
              <span v-if="status" class="badge-icon mono">{{ STATUS_ICONS[status] }}</span>
              <span v-else class="badge-plus">+</span>
            </button>

            <transition name="fade-slide">
              <div v-if="menuOpen" class="status-menu" @click.stop>
                <button
                  v-for="s in STATUSES"
                  :key="s"
                  class="status-opt"
                  :class="[`s-${s}`, { active: s === status }]"
                  @click="choose(s)"
                >
                  <span class="dot" />{{ t(`status.${s}`) }}
                </button>
              </div>
            </transition>
          </div>
        </div>

        <div v-if="status && showRating" class="rate-row">
          <RatingPicker :model-value="userRating" @update:model-value="(r) => emit('set-rating', r)" />

          <div class="badge-wrap">
            <button
              class="status-badge"
              :class="`s-${status}`"
              @click.stop="menuOpen = !menuOpen"
              :aria-label="t('status.change')"
              :title="t(`status.${status}`)"
            >
              <span class="badge-icon mono">{{ STATUS_ICONS[status] }}</span>
            </button>

            <transition name="fade-slide">
              <div v-if="menuOpen" class="status-menu" @click.stop>
                <button
                  v-for="s in STATUSES"
                  :key="s"
                  class="status-opt"
                  :class="[`s-${s}`, { active: s === status }]"
                  @click="choose(s)"
                >
                  <span class="dot" />{{ t(`status.${s}`) }}
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  border-radius: var(--radius-md);
  overflow: visible;
  transition: transform var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
}
.card.is-highlighted {
  animation: card-highlight-pulse 1.8s var(--ease-out);
}
@keyframes card-highlight-pulse {
  0% { box-shadow: 0 0 0 3px var(--accent-amber), var(--shadow-card); transform: translateY(-4px); }
  70% { box-shadow: 0 0 0 3px var(--accent-amber), var(--shadow-card); transform: translateY(-4px); }
  100% { box-shadow: none; transform: translateY(0); }
}

.art {
  position: relative;
  aspect-ratio: 3 / 4.9;
  border-radius: var(--radius-md);
}
.art-media {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  background: var(--bg-2);
  overflow: hidden;
}
.art-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dur-slow) var(--ease-out);
}
.card:hover .art-media img { transform: scale(1.06); }

.art-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-2);
}

/* dark gradient wash, bottom-to-top, so overlaid text stays legible on any cover */
.scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, rgba(8, 9, 14, 0.97) 0%, rgba(8, 9, 14, 0.95) 38%, rgba(8, 9, 14, 0.55) 58%, transparent 78%);
  pointer-events: none;
}

.remove-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(8, 9, 14, 0.55);
  color: #fdfaf2;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 2;
}

.playtime-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px 5px 7px;
  border-radius: 999px;
  background: rgba(10, 11, 16, 0.68);
  border: 1px solid rgba(253, 250, 242, 0.14);
  backdrop-filter: blur(4px);
  color: var(--accent-teal);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 4px 12px -3px rgba(0, 0, 0, 0.55);
}
.playtime-badge svg { flex-shrink: 0; }

.info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 14px 18px;
  z-index: 1;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.text-col { min-width: 0; flex: 1; min-height: 84px; display: flex; flex-direction: column; justify-content: center; }
.title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.28;
  color: #fdfaf2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.meta {
  margin: 6px 0 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: rgba(253, 250, 242, 0.78);
}
.meta-line1 {
  display: flex;
  gap: 10px;
  white-space: nowrap;
}
.meta-line2 {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta .rating { color: var(--accent-amber-2); font-weight: 700; }

.badge-wrap { position: relative; flex-shrink: 0; }

.status-badge {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fdfaf2;
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.5);
}
.status-badge.unset {
  background: rgba(253, 250, 242, 0.18);
  color: #fdfaf2;
  backdrop-filter: blur(4px);
}
.badge-plus { font-size: 18px; font-weight: 700; line-height: 1; }
.badge-icon { font-size: 14px; font-weight: 700; line-height: 1; }
.status-badge.s-completed { background: var(--card-completed); }
.status-badge.s-planned { background: var(--card-planned); }
.status-badge.s-playing { background: var(--card-playing); }
.status-badge.s-dropped { background: var(--card-dropped); }

.rate-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* positioned relative to the badge itself now, so it always lands in the
   right spot whether the badge sits in the title row or the rating row */
.status-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  background: color-mix(in srgb, var(--bg-1) 60%, transparent);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card), inset 0 1px 0 var(--glass-highlight);
  padding: 6px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
}
.status-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-1);
  text-align: left;
}
.status-opt:hover { background: var(--bg-2); }
.status-opt.active { color: var(--text-0); font-weight: 700; background: var(--bg-2); }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-opt.s-completed .dot { background: var(--card-completed); }
.status-opt.s-planned .dot { background: var(--card-planned); }
.status-opt.s-playing .dot { background: var(--card-playing); }
.status-opt.s-dropped .dot { background: var(--card-dropped); }

.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
