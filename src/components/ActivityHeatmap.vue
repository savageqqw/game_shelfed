<script setup>
import { computed } from 'vue'
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

const cells = computed(() => {
  const now = new Date()
  const buckets = []
  for (let i = props.months - 1; i >= 0; i--) {
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

const maxCount = computed(() => Math.max(1, ...cells.value.map((c) => c.count)))

function level(count) {
  if (!count) return 0
  const ratio = count / maxCount.value
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

function monthLabel(cell) {
  const d = new Date(cell.year, cell.month, 1)
  return d.toLocaleDateString(localeMap[locale.value] || undefined, { month: 'short' })
}

function fullLabel(cell) {
  const d = new Date(cell.year, cell.month, 1)
  const label = d.toLocaleDateString(localeMap[locale.value] || undefined, { month: 'long', year: 'numeric' })
  return `${label} — ${t('account.activity.count', { count: cell.count })}`
}

const totalCompleted = computed(() => cells.value.reduce((sum, c) => sum + c.count, 0))
</script>

<template>
  <div class="heatmap">
    <div class="heatmap-grid">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="heatmap-cell"
        :class="`lvl-${level(cell.count)}`"
        :title="fullLabel(cell)"
      >
        <span class="cell-count mono">{{ cell.count || '' }}</span>
        <span class="cell-label mono">{{ monthLabel(cell) }}</span>
      </div>
    </div>

    <div class="heatmap-footer">
      <span class="total-line">{{ t('account.activity.total', { count: totalCompleted }) }}</span>
      <span class="legend">
        <span class="legend-label">{{ t('account.activity.less') }}</span>
        <span class="legend-cell lvl-0" />
        <span class="legend-cell lvl-1" />
        <span class="legend-cell lvl-2" />
        <span class="legend-cell lvl-3" />
        <span class="legend-cell lvl-4" />
        <span class="legend-label">{{ t('account.activity.more') }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
  gap: 8px;
}

.heatmap-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--bg-1);
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast);
}
.heatmap-cell:hover { transform: translateY(-2px); border-color: var(--border-strong); }

.cell-count { font-size: 15px; font-weight: 700; color: var(--text-0); line-height: 1; }
.cell-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2); }

.heatmap-cell.lvl-0 { background: var(--bg-1); }
.heatmap-cell.lvl-0 .cell-label { color: var(--text-2); }
.heatmap-cell.lvl-1 { background: rgba(34, 197, 94, 0.18); border-color: rgba(34, 197, 94, 0.25); }
.heatmap-cell.lvl-2 { background: rgba(34, 197, 94, 0.36); border-color: rgba(34, 197, 94, 0.4); }
.heatmap-cell.lvl-3 { background: rgba(34, 197, 94, 0.58); border-color: rgba(34, 197, 94, 0.6); }
.heatmap-cell.lvl-4 { background: rgba(34, 197, 94, 0.85); border-color: rgba(34, 197, 94, 0.9); }
.heatmap-cell.lvl-3 .cell-count, .heatmap-cell.lvl-4 .cell-count { color: #0a1f12; }
.heatmap-cell.lvl-3 .cell-label, .heatmap-cell.lvl-4 .cell-label { color: rgba(10, 31, 18, 0.75); }

.heatmap-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.total-line { font-size: 13px; color: var(--text-2); }

.legend { display: flex; align-items: center; gap: 5px; }
.legend-label { font-size: 11px; color: var(--text-2); }
.legend-cell {
  width: 13px;
  height: 13px;
  border-radius: 4px;
  border: 1px solid var(--border-soft);
}
.legend-cell.lvl-0 { background: var(--bg-1); }
.legend-cell.lvl-1 { background: rgba(34, 197, 94, 0.18); }
.legend-cell.lvl-2 { background: rgba(34, 197, 94, 0.36); }
.legend-cell.lvl-3 { background: rgba(34, 197, 94, 0.58); }
.legend-cell.lvl-4 { background: rgba(34, 197, 94, 0.85); }
</style>
