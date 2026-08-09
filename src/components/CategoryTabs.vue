<script setup>
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: String, default: 'all' },
  counts: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const tabs = ['all', 'planned', 'playing', 'completed', 'dropped']
</script>

<template>
  <div class="cat-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab"
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
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  width: fit-content;
}
.cat-tab {
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
  transition: background var(--dur-fast), color var(--dur-fast);
}
.cat-tab:hover { color: var(--text-0); }
.cat-tab.active { background: var(--bg-3); color: var(--text-0); }
.cat-tab.active.s-completed { color: var(--status-completed); }
.cat-tab.active.s-planned { color: var(--status-planned); }
.cat-tab.active.s-playing { color: var(--status-playing); }
.cat-tab.active.s-dropped { color: var(--status-dropped); }
.count {
  font-size: 11px;
  background: var(--bg-2);
  padding: 1px 6px;
  border-radius: 999px;
}
</style>
