<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { needsConsent, setConsent } from '../utils/ads'

const { t } = useI18n()
const show = ref(false)

onMounted(() => {
  show.value = needsConsent()
})

function choose(agreed) {
  setConsent(agreed)
  show.value = false
}
</script>

<template>
  <transition name="consent">
    <aside v-if="show" class="consent" role="dialog" aria-live="polite" :aria-label="t('consent.title')">
      <p class="consent-text">
        <b>{{ t('consent.title') }}</b>
        {{ t('consent.text') }}
        <router-link :to="{ name: 'privacy' }">{{ t('consent.more') }}</router-link>
      </p>
      <div class="consent-actions">
        <button type="button" class="btn btn-ghost consent-btn" @click="choose(false)">{{ t('consent.decline') }}</button>
        <button type="button" class="btn btn-primary consent-btn" @click="choose(true)">{{ t('consent.accept') }}</button>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.consent {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 60;
  width: min(440px, calc(100vw - 32px));
  padding: 16px 16px 14px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--paper);
  border-radius: var(--radius-lg);
  box-shadow: 8px 8px 0 var(--acid);
}
.consent-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-1);
}
.consent-text b { display: block; margin-bottom: 4px; color: var(--text-0); font-weight: 800; }
.consent-text a { color: var(--acid); }
.consent-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.consent-btn { min-height: 40px; padding: 0 16px; font-size: 14px; }

.consent-enter-active, .consent-leave-active { transition: opacity var(--dur-med), transform var(--dur-med) var(--ease-out); }
.consent-enter-from, .consent-leave-to { opacity: 0; transform: translateY(16px); }

@media (max-width: 560px) {
  .consent { left: 12px; bottom: 12px; width: calc(100vw - 24px); box-shadow: 5px 5px 0 var(--acid); }
  .consent-btn { flex: 1; }
}
</style>
