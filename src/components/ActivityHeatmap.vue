<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  items: { type: Array, default: () => [] },
  months: { type: Number, default: 12 }
})

const { t, locale } = useI18n()
const localeMap = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' }

function parseDate(raw) {
  if (!raw) return null
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

const periods = [
  { key: 'm6', months: 6 },
  { key: 'm12', months: 12 },
  { key: 'm24', months: 24 },
  { key: 'all', months: null }
]
const selectedPeriod = ref('m12')

const earliestCompleted = computed(() => {
  let min = null
  for (const item of props.items) {
    const d = parseDate(item.completed_at)
    if (d && (!min || d < min)) min = d
  }
  return min
})

const effectiveMonths = computed(() => {
  const p = periods.find((p) => p.key === selectedPeriod.value)
  if (p?.months) return p.months
  // "all time" — span from the earliest completion to the current month
  if (!earliestCompleted.value) return props.months
  const now = new Date()
  const span = (now.getFullYear() - earliestCompleted.value.getFullYear()) * 12
    + (now.getMonth() - earliestCompleted.value.getMonth()) + 1
  return Math.max(1, span)
})

const bars = computed(() => {
  const now = new Date()
  const total = effectiveMonths.value
  const buckets = []
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth(), count: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  for (const item of props.items) {
    const d = parseDate(item.completed_at)
    if (!d) continue
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = byKey.get(key)
    if (bucket) bucket.count += 1
  }
  return buckets
})

const maxCount = computed(() => Math.max(1, ...bars.value.map((b) => b.count)))

// nice round number for the top gridline (1, 2, 5, 10, 20, 25, 50...)
const axisMax = computed(() => {
  const m = maxCount.value
  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100]
  return steps.find((s) => s >= m) || Math.ceil(m / 10) * 10
})

const gridLines = computed(() => {
  const top = axisMax.value
  return [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0]
})

function heightPct(count) {
  if (!count) return 0
  return Math.max(4, (count / axisMax.value) * 100)
}

function monthLabel(bar) {
  const d = new Date(bar.year, bar.month, 1)
  return d.toLocaleDateString(localeMap[locale.value] || undefined, { month: 'short' })
}

function fullLabel(bar) {
  const d = new Date(bar.year, bar.month, 1)
  const label = d.toLocaleDateString(localeMap[locale.value] || undefined, { month: 'long', year: 'numeric' })
  return `${label} — ${t('account.activity.count', { count: bar.count })}`
}

const totalCompleted = computed(() => bars.value.reduce((sum, b) => sum + b.count, 0))

// animate bars growing in from 0, both on mount and whenever the period changes
const grown = ref(false)
function replay() {
  grown.value = false
  nextTick(() => requestAnimationFrame(() => requestAnimationFrame(() => { grown.value = true })))
}
onMounted(replay)
watch(selectedPeriod, replay)
</script>

<template>
  <div class="chart">
    <div class="period-row">
      <button
        v-for="p in periods"
        :key="p.key"
        class="period-btn"
        :class="{ active: selectedPeriod === p.key }"
        @click="selectedPeriod = p.key"
      >{{ t(`account.activity.periods.${p.key}`) }}</button>
    </div>

    <div class="chart-plot-wrap">
      <div class="chart-plot" :style="{ minWidth: bars.length > 14 ? bars.length * 40 + 'px' : '100%' }">
        <div class="grid-lines">
          <div v-for="g in gridLines" :key="g" class="grid-line">
            <span class="grid-value mono">{{ g }}</span>
          </div>
        </div>

        <div class="bars">
          <div v-for="bar in bars" :key="bar.key" class="bar-col" :title="fullLabel(bar)">
            <span class="bar-value mono" :class="{ show: bar.count > 0 }">{{ bar.count }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :class="{ empty: !bar.count }"
                :style="{ height: grown ? heightPct(bar.count) + '%' : 0 }"
              />
            </div>
            <span class="bar-label mono">{{ monthLabel(bar) }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="chart-total">{{ t('account.activity.total', { count: totalCompleted }) }}</p>
  </div>
</template>

<style scoped>
.period-row {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
}
.period-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast);
}
.period-btn:hover { color: var(--text-0); border-color: var(--border-strong); }
.period-btn.active {
  color: var(--card-completed);
  border-color: var(--card-completed);
  background: rgba(34, 197, 94, 0.12);
}

.chart-plot-wrap { overflow-x: auto; }

.chart-plot {
  position: relative;
  display: flex;
  height: 200px;
  padding-left: 30px;
}

.grid-lines {
  position: absolute;
  inset: 0 0 26px 30px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}
.grid-line {
  position: relative;
  border-top: 1px dashed var(--border-soft);
}
.grid-line:last-child { border-top: 1px solid var(--border-strong); }
.grid-value {
  position: absolute;
  left: -30px;
  top: -6px;
  width: 26px;
  text-align: right;
  font-size: 10px;
  color: var(--text-2);
}

.bars {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: clamp(4px, 1vw, 12px);
  padding-bottom: 26px;
}

.bar-col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}

.bar-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-0);
  margin-bottom: 4px;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.bar-value.show { opacity: 1; }

.bar-track {
  width: 100%;
  max-width: 34px;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.bar-fill {
  width: 100%;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #4ade80 0%, var(--card-completed) 100%);
  box-shadow: 0 0 14px -4px rgba(34, 197, 94, 0.6);
  transition: height 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}
.bar-fill.empty {
  background: var(--bg-2);
  box-shadow: none;
  height: 3px !important;
}

.bar-col:hover .bar-fill:not(.empty) {
  filter: brightness(1.15);
}

.bar-label {
  position: absolute;
  bottom: 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-2);
}

.chart-total {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--text-2);
  text-align: right;
}
</style>
