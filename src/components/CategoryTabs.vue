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
const indicator = ref({ left: 0, width: 0 })

function setTabRef(el, i) {
  if (el) tabRefs.value[i] = el
}

function updateIndicator() {
  const i = tabs.indexOf(props.modelValue)
  const el = tabRefs.value[i]
  if (!el) return
  indicator.value = { left: el.offsetLeft, width: el.offsetWidth }
}

watch(() => props.modelValue, () => nextTick(updateIndicator))

let ro
onMounted(() => {
  nextTick(updateIndicator)
  ro = new ResizeObserver(() => updateIndicator())
  tabRefs.value.forEach((el) => el && ro.observe(el))
})
onBeforeUnmount(() => ro && ro.disconnect())
</script>

<template>
  <div class="cat-tabs" role="tablist">
    <span
      class="indicator"
      :style="{ transform: `translateX(${indicator.left}px)`, width: indicator.width + 'px' }"
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
  gap: 4px;
  flex-wrap: wrap;
  width: fit-content;
}
.indicator {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 999px;
  background: var(--bg-3);
  transition: transform var(--dur-med) var(--ease-out), width var(--dur-med) var(--ease-out);
  pointer-events: none;
  z-index: 0;
}
.cat-tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 13px;
  transition: color var(--dur-fast);
}
.cat-tab:hover { color: var(--text-0); }
.cat-tab.active { color: var(--text-0); }
.cat-tab.active.s-completed { color: var(--card-completed); }
.cat-tab.active.s-planned { color: var(--card-planned); }
.cat-tab.active.s-playing { color: var(--card-playing); }
.cat-tab.active.s-dropped { color: var(--card-dropped); }
.count {
  font-size: 11px;
  background: var(--bg-2);
  padding: 1px 6px;
  border-radius: 999px;
}
</style>
