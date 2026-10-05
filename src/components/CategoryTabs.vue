<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUSES } from '../stores/library'

const props = defineProps({
  modelValue: { type: String, default: 'all' },
  counts: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const tabs = [...STATUSES, 'all']

const tabRefs = ref([])
const indicator = ref({ left: 0, top: 0, width: 0, height: 0 })

function setTabRef(el, i) {
  if (el) tabRefs.value[i] = el
}

function updateIndicator() {
  const i = tabs.indexOf(props.modelValue)
  const el = tabRefs.value[i]
  if (!el) return
  indicator.value = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
}

// counts arriving widen the tabs before the active one and push it sideways
// without resizing it, so re-measure on those too, not only on resize
watch(() => props.modelValue, () => nextTick(updateIndicator))
watch(() => props.counts, () => nextTick(updateIndicator), { deep: true })

const rootEl = ref(null)
let ro
onMounted(() => {
  nextTick(updateIndicator)
  ro = new ResizeObserver(() => updateIndicator())
  tabRefs.value.forEach((el) => el && ro.observe(el))
  if (rootEl.value) ro.observe(rootEl.value)
  document.fonts?.ready.then(updateIndicator)
})
onBeforeUnmount(() => ro && ro.disconnect())
</script>

<template>
  <div ref="rootEl" class="cat-tabs" role="tablist">
    <span
      class="indicator"
      :class="`s-${modelValue}`"
      :style="{ transform: `translate(${indicator.left}px, ${indicator.top}px)`, width: indicator.width + 'px', height: indicator.height + 'px' }"
    />
    <button
      v-for="(tab, i) in tabs"
      :key="tab"
      :ref="(el) => setTabRef(el, i)"
      class="cat-tab"
      :class="[`s-${tab}`, { active: modelValue === tab }]"
      role="tab"
      :aria-selected="modelValue === tab"
      @click="emit('update:modelValue', tab)"
    >
      {{ t(`myGames.tabs.${tab}`) }}
      <span v-if="tab !== 'all' && counts[tab]" class="count mono">{{ counts[tab] }}</span>
    </button>
  </div>
</template>

<style scoped>
.cat-tabs {
  position: relative;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  width: fit-content;
  max-width: 100%;
  padding: 3px;
  border: var(--stroke) solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--bg-1);
}
.indicator {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--radius-sm);
  background: var(--paper);
  transition: transform var(--dur-med) var(--ease-out), width var(--dur-med) var(--ease-out), background var(--dur-fast);
  pointer-events: none;
  z-index: 0;
}
.indicator.s-completed { background: var(--st-completed); }
.indicator.s-planned { background: var(--st-planned); }
.indicator.s-playing { background: var(--st-playing); }
.indicator.s-dropped { background: var(--st-dropped); }
.cat-tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-1);
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
  transition: color var(--dur-fast);
}
.cat-tab:hover { color: var(--text-0); }
.cat-tab.active { color: var(--ink); }
.count {
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-3);
  color: var(--text-0);
  border-radius: 2px;
}
.cat-tab.active .count { background: var(--ink); color: var(--paper); }
</style>
