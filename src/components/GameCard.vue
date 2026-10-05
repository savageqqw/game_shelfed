<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUSES, STATUS_ICON_NAMES } from '../stores/library'
import RatingPicker from './RatingPicker.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  game: { type: Object, required: true }, // { id, title, cover, rating, released, genres }
  status: { type: String, default: null },
  userRating: { type: String, default: null }, // null | 'like' | 'dislike' | 'mixed'
  showRating: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false } // true when viewing someone else's public shelf
})
const emit = defineEmits(['set-status', 'remove', 'set-rating'])

const { t } = useI18n()
const menuOpen = ref(false)

// Only IGDB-catalog games (plain numeric ids) have a detail page; Steam
// imports that never got matched to the catalog use a 'steam:123' id and
// have nowhere to link to.
const isLinkable = /^\d+$/.test(String(props.game.id))

function formatPlaytime(minutes) {
  const hours = minutes / 60
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10
  return t('steamImport.hoursPlayed', { hours: rounded })
}

function choose(s) {
  emit('set-status', s)
  menuOpen.value = false
}

// close the status menu on any outside click or Escape
function closeMenu() { menuOpen.value = false }
function onKey(e) { if (e.key === 'Escape') closeMenu() }
watch(menuOpen, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('click', closeMenu), 0)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('click', closeMenu)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <article class="card" :class="[status ? `s-${status}` : '', { shelved: !!status, 'menu-open': menuOpen }]">
    <div class="art">
      <router-link v-if="isLinkable" :to="{ name: 'game-detail', params: { id: game.id } }" class="art-link" :aria-label="game.title" tabindex="-1">
        <img v-if="game.cover" :src="game.cover" :alt="game.title" loading="lazy" />
        <div v-else class="art-fallback"><span>{{ game.title.slice(0, 2).toUpperCase() }}</span></div>
      </router-link>
      <template v-else>
        <img v-if="game.cover" :src="game.cover" :alt="game.title" loading="lazy" />
        <div v-else class="art-fallback"><span>{{ game.title.slice(0, 2).toUpperCase() }}</span></div>
      </template>

      <button
        v-if="status && !readonly"
        class="remove-btn"
        @click.stop="emit('remove')"
        :aria-label="t('status.remove')"
        :title="t('status.remove')"
      ><AppIcon name="x" :size="14" :stroke="2.5" /></button>

      <span v-if="game.playtimeMinutes" class="playtime-badge mono">
        <AppIcon name="clock" :size="12" :stroke="2.5" />
        {{ formatPlaytime(game.playtimeMinutes) }}
      </span>

      <span v-if="status" class="sticker mono">
        <AppIcon :name="STATUS_ICON_NAMES[status]" :size="11" :stroke="3" />
        {{ t(`status.${status}`) }}
      </span>
    </div>

    <div class="label">
      <div class="info-row">
        <div class="text-col">
          <h3 class="title">
            <router-link v-if="isLinkable" :to="{ name: 'game-detail', params: { id: game.id } }" class="title-link">{{ game.title }}</router-link>
            <template v-else>{{ game.title }}</template>
          </h3>
          <p class="meta mono">
            <span v-if="game.rating" class="rating">★{{ game.rating.toFixed(1) }}</span>
            <span v-if="game.released">{{ game.released.slice(0, 4) }}</span>
            <span v-if="game.genres?.length" class="genre">{{ game.genres[0] }}</span>
          </p>
        </div>

        <div v-if="!showRating && (status || !readonly)" class="badge-wrap">
          <button
            class="status-badge"
            :class="[status ? `s-${status}` : 'unset', { 'is-readonly': readonly }]"
            @click.stop="!readonly && (menuOpen = !menuOpen)"
            :aria-label="status ? t('status.change') : t('status.add')"
            :aria-expanded="menuOpen"
            :title="status ? t(`status.${status}`) : t('status.add')"
          >
            <AppIcon v-if="status" :name="STATUS_ICON_NAMES[status]" :size="16" :stroke="2.75" />
            <AppIcon v-else-if="!readonly" name="plus" :size="18" :stroke="2.5" />
          </button>

          <transition name="pop">
            <div v-if="menuOpen && !readonly" class="status-menu" @click.stop>
              <button
                v-for="s in STATUSES"
                :key="s"
                class="status-opt"
                :class="[`s-${s}`, { active: s === status }]"
                @click="choose(s)"
              >
                <span class="dot" />{{ t(`status.${s}`) }}
                <AppIcon v-if="s === status" name="check" :size="14" :stroke="3" class="opt-check" />
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
            :aria-expanded="menuOpen"
            :title="t(`status.${status}`)"
          >
            <AppIcon :name="STATUS_ICON_NAMES[status]" :size="16" :stroke="2.75" />
          </button>

          <transition name="pop">
            <div v-if="menuOpen" class="status-menu" @click.stop>
              <button
                v-for="s in STATUSES"
                :key="s"
                class="status-opt"
                :class="[`s-${s}`, { active: s === status }]"
                @click="choose(s)"
              >
                <span class="dot" />{{ t(`status.${s}`) }}
                <AppIcon v-if="s === status" name="check" :size="14" :stroke="3" class="opt-check" />
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* A cartridge: cover art on top, a printed label strip underneath.
   On hover it lifts and casts a hard shadow in its status colour
   (acid when it isn't on a shelf yet). */
.card {
  --tone: var(--acid);
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
  transition:
    transform var(--dur-med) var(--ease-out),
    box-shadow var(--dur-med) var(--ease-out),
    border-color var(--dur-fast);
}
.card.s-completed { --tone: var(--st-completed); }
.card.s-planned { --tone: var(--st-planned); }
.card.s-playing { --tone: var(--st-playing); }
.card.s-dropped { --tone: var(--st-dropped); }
.card.shelved { border-color: color-mix(in srgb, var(--tone) 45%, var(--line)); }

.card:hover,
.card:focus-within,
.card.menu-open {
  transform: translate(-4px, -4px);
  border-color: var(--tone);
  box-shadow: 6px 6px 0 var(--tone);
  z-index: 3;
}

.card.is-highlighted {
  animation: card-highlight 1.8s var(--ease-out);
}
@keyframes card-highlight {
  0%, 70% { transform: translate(-4px, -4px) rotate(-1deg); box-shadow: 8px 8px 0 var(--acid); border-color: var(--acid); }
  100% { transform: none; box-shadow: none; }
}

.art {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: calc(var(--radius-lg) - 2px) calc(var(--radius-lg) - 2px) 0 0;
  background: var(--bg-2);
  border-bottom: var(--stroke) solid var(--line);
  overflow: hidden;
}
.card.shelved .art { border-bottom-color: color-mix(in srgb, var(--tone) 45%, var(--line)); }
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--dur-slow) var(--ease-out);
}
.card:hover .art img { transform: scale(1.05); }

.art-link {
  display: block;
  width: 100%;
  height: 100%;
}

.art-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    repeating-linear-gradient(-45deg, rgba(243, 239, 228, 0.04) 0 2px, transparent 2px 10px),
    var(--bg-2);
}
.art-fallback span {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 800;
  color: var(--text-2);
}

.remove-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1.5px solid rgba(243, 239, 228, 0.25);
  background: rgba(12, 12, 14, 0.78);
  color: var(--paper);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  opacity: 0;
  transition: opacity var(--dur-fast), background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}
.card:hover .remove-btn,
.card:focus-within .remove-btn { opacity: 1; }
.remove-btn:hover { background: var(--st-dropped); border-color: var(--st-dropped); color: var(--ink); }
@media (hover: none) { .remove-btn { opacity: 1; } }

.playtime-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  border-radius: 2px;
  background: var(--paper);
  color: var(--ink);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  transform: rotate(2deg);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.45);
}

/* status sticker slapped across the bottom-left corner of the art */
.sticker {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 3px;
  background: var(--tone);
  color: var(--ink);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 2px;
  transform: rotate(-3deg);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
}

.label {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 12px 14px;
}
.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.text-col { min-width: 0; flex: 1; }
.title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-0);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}
.title-link {
  color: inherit;
  text-decoration: none;
  background-image: linear-gradient(var(--tone), var(--tone));
  background-size: 0 2px;
  background-repeat: no-repeat;
  background-position: 0 100%;
  transition: background-size var(--dur-med) var(--ease-out);
}
.title-link:hover { background-size: 100% 2px; }
.meta {
  margin: 7px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
}
.meta > span + span::before {
  content: '/';
  margin-right: 8px;
  color: var(--line-strong);
}
.meta .rating { color: var(--acid); font-weight: 700; }
.meta .genre { overflow: hidden; text-overflow: ellipsis; min-width: 0; }

.badge-wrap { position: relative; flex-shrink: 0; }

.status-badge {
  --tone: var(--acid);
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  border: var(--stroke) dashed var(--line-strong);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-1);
  transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}
.status-badge.unset:hover { border-style: solid; border-color: var(--acid); color: var(--ink); background: var(--acid); }
.status-badge.is-readonly { cursor: default; }
.status-badge.s-completed { --tone: var(--st-completed); }
.status-badge.s-planned { --tone: var(--st-planned); }
.status-badge.s-playing { --tone: var(--st-playing); }
.status-badge.s-dropped { --tone: var(--st-dropped); }
.status-badge:not(.unset) {
  border-style: solid;
  border-color: var(--tone);
  background: var(--tone);
  color: var(--ink);
}
.status-badge:not(.is-readonly):active { transform: scale(0.92); }

.rate-row {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.status-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  background: var(--bg-1);
  border: var(--stroke) solid var(--paper);
  border-radius: var(--radius-md);
  box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
  padding: 5px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 170px;
  transform-origin: bottom right;
}
.status-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  text-align: left;
}
.status-opt:hover { background: var(--bg-3); color: var(--text-0); }
.status-opt.active { color: var(--text-0); }
.opt-check { margin-left: auto; color: var(--acid); }

.pop-enter-active { transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-med) var(--ease-spring); }
.pop-leave-active { transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.94); }

@media (max-width: 560px) {
  .card:hover, .card:focus-within, .card.menu-open { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 var(--tone); }
  .label { padding: 9px 8px 9px 10px; }
  .title { font-size: 13px; }
  .meta { font-size: 10px; gap: 6px; }
  .meta > span + span::before { margin-right: 6px; }
  .meta .genre { display: none; }
  .status-badge { width: 34px; height: 34px; }
  .sticker { font-size: 9px; padding: 3px 6px 2px; left: 6px; bottom: 6px; }
  .playtime-badge { font-size: 9.5px; padding: 3px 5px; top: 6px; right: 6px; }
  .remove-btn { width: 28px; height: 28px; top: 6px; left: 6px; }
  .status-menu { min-width: 150px; }
}
</style>
