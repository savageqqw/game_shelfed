<script setup>
import { useI18n } from 'vue-i18n'
import AppIcon from '../components/AppIcon.vue'
const { t } = useI18n()
</script>

<template>
  <div class="shell not-found">
    <div class="nf-shelf" aria-hidden="true">
      <span class="nf-box b1" />
      <span class="nf-code">404</span>
      <span class="nf-box b2" />
    </div>
    <h1>{{ t('notFound.title') }}</h1>
    <p class="nf-text">{{ t('notFound.text') }}</p>
    <router-link :to="{ name: 'library' }" class="btn btn-primary">
      <AppIcon name="arrow-left" :size="16" />{{ t('notFound.cta') }}
    </router-link>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 56vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  padding-top: 20px;
}
.nf-shelf {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 4px solid var(--paper);
  margin-bottom: 18px;
}
.nf-code {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(90px, 18vw, 180px);
  line-height: 0.82;
  letter-spacing: -0.06em;
  color: transparent;
  -webkit-text-stroke: 2px var(--acid);
}
.nf-box {
  width: 26px;
  border: var(--stroke) solid var(--line-strong);
  border-bottom: none;
  border-radius: 3px 3px 0 0;
  background: var(--bg-2);
}
.b1 { height: 90px; }
.b2 { height: 120px; transform: rotate(12deg); transform-origin: bottom left; }
h1 { font-size: clamp(24px, 3vw, 34px); font-weight: 800; }
.nf-text { color: var(--text-1); margin: 0 0 8px; font-size: 16px; }
</style>
