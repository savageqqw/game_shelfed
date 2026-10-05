<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  modelValue: { type: String, default: null } // null | 'like' | 'dislike' | 'mixed'
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const options = [
  { value: null, icon: 'minus' },
  { value: 'like', icon: 'thumbs-up' },
  { value: 'dislike', icon: 'thumbs-down' },
  { value: 'mixed', icon: 'meh' }
]

const optRefs = ref([])
const indicator = ref({ left: 0, width: 0 })
// starts false so the very first positioning (on mount) happens instantly,
// with no slide-in from 0 — only user-driven changes afterwards animate
const ready = ref(false)

function setRef(el, i) {
  if (el) optRefs.value[i] = el
}

function activeIndex() {
  const i = options.findIndex((o) => o.value === props.modelValue)
  return i === -1 ? 0 : i
}

function updateIndicator() {
  const el = optRefs.value[activeIndex()]
  if (!el) return
  indicator.value = { left: el.offsetLeft, width: el.offsetWidth }
}

watch(() => props.modelValue, () => nextTick(updateIndicator))

let ro
onMounted(() => {
  nextTick(() => {
    updateIndicator()
    // let the initial jump paint first, then arm the transition
    requestAnimationFrame(() => requestAnimationFrame(() => { ready.value = true }))
  })
  ro = new ResizeObserver(() => updateIndicator())
  optRefs.value.forEach((el) => el && ro.observe(el))
})
onBeforeUnmount(() => ro && ro.disconnect())

function choose(opt, event) {
  event.stopPropagation()
  emit('update:modelValue', opt.value === props.modelValue ? null : opt.value)
}
</script>

<template>
  <div class="rating-picker" role="radiogroup" :aria-label="t('rating.label')">
    <span
      class="indicator"
      :class="[{ ready }, modelValue ? `r-${modelValue}` : 'r-none']"
      :style="{ transform: `translateX(${indicator.left}px)`, width: indicator.width + 'px' }"
    />
    <button
      v-for="(opt, i) in options"
      :key="opt.value || 'none'"
      :ref="(el) => setRef(el, i)"
      type="button"
      class="rate-opt"
      :class="{ active: modelValue === opt.value }"
      role="radio"
      :aria-checked="modelValue === opt.value"
      :aria-label="t(`rating.${opt.value || 'none'}`)"
      :title="t(`rating.${opt.value || 'none'}`)"
      @click="choose(opt, $event)"
    >
      <AppIcon :name="opt.icon" :size="15" :stroke="2.25" />
    </button>
  </div>
</template>

<style scoped>
.rating-picker {
  position: relative;
  display: inline-flex;
  gap: 0;
  padding: 2px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--line-strong);
  background: var(--bg-0);
  width: fit-content;
}
.indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  border-radius: 2px;
  background: var(--bg-3);
  transition: none;
  pointer-events: none;
  z-index: 0;
}
.indicator.r-like { background: var(--st-completed); }
.indicator.r-dislike { background: var(--st-dropped); }
.indicator.r-mixed { background: var(--st-planned); }
.indicator.ready {
  transition: transform var(--dur-med) var(--ease-out), width var(--dur-med) var(--ease-out), background var(--dur-fast);
}
.rate-opt {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  border-radius: 2px;
  border: none;
  background: transparent;
  color: var(--text-2);
  transition: color var(--dur-fast);
}
.rate-opt:hover { color: var(--text-0); }
.rate-opt.active { color: var(--ink); }
.rate-opt.active:first-of-type { color: var(--text-0); }

@media (max-width: 560px) {
  .rate-opt { width: 26px; height: 28px; }
}
</style>
