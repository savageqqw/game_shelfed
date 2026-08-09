<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUSES } from '../stores/library'
import RatingPicker from './RatingPicker.vue'

const props = defineProps({
  game: { type: Object, required: true }, // { id, title, cover, rating, released, genres }
  status: { type: String, default: null },
  userRating: { type: String, default: null } // null | 'like' | 'dislike' | 'mixed'
})
const emit = defineEmits(['set-status', 'remove', 'set-rating'])

const { t } = useI18n()
const menuOpen = ref(false)

function choose(s) {
  emit('set-status', s)
  menuOpen.value = false
}
</script>

<template>
  <article class="card" :class="{ shelved: !!status }">
    <div class="art">
      <img v-if="game.cover" :src="game.cover" :alt="game.title" loading="lazy" />
      <div v-else class="art-fallback mono">{{ game.title.slice(0, 2).toUpperCase() }}</div>

      <div v-if="status" class="tag-hang" :class="`s-${status}`">
        <svg class="tag-shape" viewBox="0 0 90 32" preserveAspectRatio="none">
          <path d="M0 0 H78 L90 16 L78 32 H0 Z" fill="currentColor" />
        </svg>
        <span class="tag-hole" />
        <span class="tag-text mono">{{ t(`status.${status}`) }}</span>
      </div>

      <div class="art-scrim">
        <span v-if="game.rating" class="rating mono">★ {{ game.rating.toFixed(1) }}</span>
        <span v-if="game.released" class="year mono">{{ game.released.slice(0, 4) }}</span>
      </div>
    </div>

    <div class="body">
      <h3 class="title">{{ game.title }}</h3>
      <p v-if="game.genres?.length" class="genres">{{ game.genres.slice(0, 3).join(' · ') }}</p>
      <p class="sku mono">SKU-{{ String(game.id).padStart(5, '0') }}</p>

      <div class="actions">
        <button class="btn btn-primary pick-btn" @click="menuOpen = !menuOpen">
          {{ status ? t('status.change') : t('status.add') }}
        </button>
        <button v-if="status" class="btn btn-ghost remove-btn" @click="emit('remove')" :aria-label="t('status.remove')">✕</button>
      </div>

      <div v-if="status" class="rate-row">
        <span class="rate-label">{{ t('rating.label') }}</span>
        <RatingPicker :model-value="userRating" @update:model-value="(r) => emit('set-rating', r)" />
      </div>

      <transition name="fade-slide">
        <div v-if="menuOpen" class="status-menu">
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

    <!-- cartridge notch: visual progress indicator along bottom edge -->
    <div class="notch" :class="status ? `s-${status}` : ''" />
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), border-color var(--dur-fast);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
  border-color: var(--border-strong);
}

.art {
  position: relative;
  aspect-ratio: 3 / 4;
  background: var(--bg-2);
  overflow: hidden;
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dur-slow) var(--ease-out);
}
.card:hover .art img { transform: scale(1.06); }

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

/* die-cut price tag, hanging off the top-right edge of the cover art */
.tag-hang {
  position: absolute;
  top: 14px;
  right: -6px;
  width: 88px;
  height: 30px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
}
.tag-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.tag-hole {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-1);
}
.tag-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.tag-hang.s-completed { color: var(--status-completed); }
.tag-hang.s-planned { color: var(--status-planned); }
.tag-hang.s-playing { color: var(--status-playing); }
.tag-hang.s-dropped { color: var(--status-dropped); }
.tag-hang.s-completed .tag-text,
.tag-hang.s-planned .tag-text { color: #1a1408; }
.tag-hang.s-playing .tag-text,
.tag-hang.s-dropped .tag-text { color: #fdfaf2; }

.art-scrim {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  background: linear-gradient(0deg, rgba(0,0,0,0.65), transparent);
  font-size: 11px;
  color: #fff;
}

.body {
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.title {
  font-size: 15px;
  line-height: 1.3;
  color: var(--text-0);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sku {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--text-2);
  opacity: 0.7;
}
.genres {
  margin: 0;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.pick-btn { flex: 1; padding: 9px 14px; font-size: 13px; }
.remove-btn { padding: 9px 12px; }

.rate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.rate-label {
  font-size: 11px;
  color: var(--text-2);
  font-weight: 600;
}

.status-menu {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 62px;
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  padding: 6px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
.status-opt.s-completed .dot { background: var(--status-completed); }
.status-opt.s-planned .dot { background: var(--status-planned); }
.status-opt.s-playing .dot { background: var(--status-playing); }
.status-opt.s-dropped .dot { background: var(--status-dropped); }

.notch {
  height: 4px;
  width: 100%;
  background: var(--bg-3);
}
.notch.s-completed { background: linear-gradient(90deg, var(--status-completed), var(--accent-amber)); }
.notch.s-planned { background: linear-gradient(90deg, var(--status-planned), var(--accent-teal)); }
.notch.s-playing { background: linear-gradient(90deg, var(--status-playing), var(--accent-amber-2)); }
.notch.s-dropped { background: linear-gradient(90deg, var(--status-dropped), var(--accent-red)); }
</style>
