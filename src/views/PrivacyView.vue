<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSeo } from '../composables/useSeo'
import { CONTACT_EMAIL, CONTACT_URL } from '../config'

const { t, tm, rt } = useI18n()

useSeo(() => ({
  title: t('privacy.title'),
  description: t('privacy.lead'),
  path: '/privacy'
}))

// sections live in the locale files as { title, text: [...], list: [...] }
const sections = computed(() =>
  (tm('privacy.sections') || []).map((s) => ({
    title: rt(s.title),
    text: (s.text || []).map((p) => rt(p)),
    list: (s.list || []).map((p) => rt(p))
  }))
)
</script>

<template>
  <div class="shell privacy-view">
    <header class="p-hero">
      <span class="tape tape-paper">{{ t('privacy.eyebrow') }}</span>
      <h1>{{ t('privacy.title') }}</h1>
      <p class="lead">{{ t('privacy.lead') }}</p>
      <p class="updated mono">{{ t('privacy.updated') }}</p>
    </header>

    <ol class="p-sections">
      <li v-for="(s, i) in sections" :key="i" class="p-section">
        <h2><span class="p-num mono">{{ String(i + 1).padStart(2, '0') }}</span>{{ s.title }}</h2>
        <p v-for="(p, j) in s.text" :key="'t' + j">{{ p }}</p>
        <ul v-if="s.list.length">
          <li v-for="(item, j) in s.list" :key="'l' + j">{{ item }}</li>
        </ul>
      </li>
      <li class="p-section">
        <h2><span class="p-num mono">{{ String(sections.length + 1).padStart(2, '0') }}</span>{{ t('privacy.contactTitle') }}</h2>
        <p>
          {{ t('privacy.contactText') }}
          <a v-if="CONTACT_EMAIL" :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>
          <a v-else :href="CONTACT_URL" target="_blank" rel="noopener">{{ t('privacy.contactLink') }}</a>
        </p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.privacy-view { max-width: 820px; padding-bottom: 20px; }

.p-hero { padding: 12px 0 28px; border-bottom: var(--stroke) solid var(--line); }
.p-hero h1 {
  margin-top: 20px;
  font-size: clamp(30px, 4.4vw, 52px);
  font-weight: 800;
  letter-spacing: -0.035em;
}
.lead { margin: 16px 0 0; color: var(--text-1); font-size: 17px; line-height: 1.6; }
.updated { margin: 14px 0 0; font-size: 12px; color: var(--text-2); letter-spacing: 0.06em; }

.p-sections { list-style: none; margin: 0; padding: 0; }
.p-section { padding: 26px 0; border-bottom: 1.5px dashed var(--line); }
.p-section:last-child { border-bottom: none; }
.p-section h2 {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: clamp(19px, 2.2vw, 24px);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.p-num { font-size: 13px; color: var(--acid); letter-spacing: 0.08em; }
.p-section p, .p-section li {
  color: var(--text-1);
  font-size: 15.5px;
  line-height: 1.65;
}
.p-section p { margin: 12px 0 0; }
.p-section ul { margin: 12px 0 0; padding-left: 20px; }
.p-section li + li { margin-top: 6px; }
.p-section a { color: var(--acid); }
</style>
