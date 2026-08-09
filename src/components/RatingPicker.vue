<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: String, default: null } // null | 'like' | 'dislike' | 'mixed'
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const options = [
  { value: null, icon: '–' },
  { value: 'like', icon: '👍' },
  { value: 'dislike', icon: '👎' },
  { value: 'mixed', icon: '🤝' }
]

const optRefs = ref([])
const indicator = ref({ left: 0, width: 0 })

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
  nextTick(updateIndicator)
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
      {{ opt.icon }}
    </button>
  </div>
</template>

<style scoped>
.rating-picker {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--bg-2);
  width: fit-content;
}
.indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  border-radius: 999px;
  background: var(--bg-3);
  transition: transform var(--dur-med) var(--ease-out), width var(--dur-med) var(--ease-out);
  pointer-events: none;
  z-index: 0;
}
.rate-opt {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 14px;
  line-height: 1;
  color: var(--text-2);
  opacity: 0.55;
  transition: opacity var(--dur-fast);
}
.rate-opt:hover { opacity: 0.85; }
.rate-opt.active { opacity: 1; }
</style>
