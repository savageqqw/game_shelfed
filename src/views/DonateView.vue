<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSeo } from '../composables/useSeo'
import { MONO_JAR_URL, CRYPTO_WALLETS } from '../config'
import AppIcon from '../components/AppIcon.vue'
import NetworkIcon from '../components/NetworkIcon.vue'

const { t } = useI18n()

useSeo(() => ({
  title: t('donate.title'),
  description: t('donate.lead'),
  path: '/donate'
}))

const jarLabel = MONO_JAR_URL.replace(/^https?:\/\//, '')
const copiedId = ref(null)
const failedId = ref(null)
let resetTimer = null

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // no Clipboard API, or the browser refused it (in-app browsers often
    // do): fall back to selecting a hidden textarea
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('copy failed')
}

async function copy(wallet) {
  clearTimeout(resetTimer)
  copiedId.value = null
  failedId.value = null
  try {
    await writeClipboard(wallet.address)
    copiedId.value = wallet.id
  } catch {
    failedId.value = wallet.id
  }
  resetTimer = setTimeout(() => {
    copiedId.value = null
    failedId.value = null
  }, 1800)
}
</script>

<template>
  <div class="shell donate-view">
    <header class="d-hero">
      <span class="tape tape-hot"><AppIcon name="heart" :size="13" :stroke="2.5" />{{ t('donate.eyebrow') }}</span>
      <h1>{{ t('donate.title') }}</h1>
      <p class="lead">{{ t('donate.lead') }}</p>
    </header>

    <div class="d-grid">
      <section class="jar-card">
        <div class="jar-top">
          <span class="jar-badge"><AppIcon name="coin" :size="26" /></span>
          <span class="jar-kind mono">UAH · Monobank</span>
        </div>
        <h2>{{ t('donate.monoTitle') }}</h2>
        <p class="jar-text">{{ t('donate.monoText') }}</p>
        <a :href="MONO_JAR_URL" target="_blank" rel="noopener" class="btn jar-btn">
          {{ t('donate.monoCta') }}<AppIcon name="external" :size="16" />
        </a>
        <span class="jar-url mono">{{ jarLabel }}</span>
      </section>

      <section class="crypto">
        <h2 class="rule-head">{{ t('donate.cryptoTitle') }}<span class="rule-count">{{ String(CRYPTO_WALLETS.length).padStart(2, '0') }}</span></h2>
        <p class="crypto-text">{{ t('donate.cryptoText') }}</p>

        <ul class="wallets">
          <li v-for="w in CRYPTO_WALLETS" :key="w.id" class="wallet" :class="{ copied: copiedId === w.id }">
            <NetworkIcon :id="w.id" :size="42" />
            <div class="w-main">
              <div class="w-head">
                <span class="w-net">{{ w.network }}</span>
                <span class="w-tag mono">{{ w.tag }}</span>
              </div>
              <code class="w-addr mono">{{ w.address }}</code>
            </div>
            <button
              type="button"
              class="w-copy"
              :class="{ ok: copiedId === w.id, bad: failedId === w.id }"
              @click="copy(w)"
              :aria-label="`${t('donate.copy')}: ${w.network}`"
            >
              <AppIcon :name="copiedId === w.id ? 'check' : 'copy'" :size="16" :stroke="2.5" />
              <span>{{ copiedId === w.id ? t('donate.copied') : failedId === w.id ? t('donate.copyFailed') : t('donate.copy') }}</span>
            </button>
          </li>
        </ul>

        <p class="note">
          <AppIcon name="alert" :size="18" class="note-icon" />
          <span>{{ t('donate.warning') }} {{ t('donate.evmNote') }}</span>
        </p>
      </section>
    </div>

    <p class="thanks">{{ t('donate.thanks') }}</p>
    <span class="sr-only" aria-live="polite">{{ copiedId ? t('donate.copied') : '' }}</span>
  </div>
</template>

<style scoped>
.donate-view { padding-bottom: 20px; }

.d-hero { padding: 12px 0 36px; max-width: 720px; }
.d-hero .tape :deep(svg) { margin-right: 2px; }
.d-hero h1 {
  margin-top: 20px;
  font-size: clamp(32px, 5vw, 60px);
  font-weight: 800;
  letter-spacing: -0.035em;
}
.lead { margin: 18px 0 0; color: var(--text-1); font-size: 17px; line-height: 1.6; max-width: 600px; }

.d-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 32px;
  align-items: start;
}

/* --- monobank jar: the one big orange slab on the page --- */
.jar-card {
  position: sticky;
  top: calc(var(--nav-h) + 20px);
  padding: 26px 24px 24px;
  background: var(--hot);
  color: var(--ink);
  border: var(--stroke) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: 10px 10px 0 var(--paper);
}
.jar-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.jar-badge {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--hot);
  display: flex;
  align-items: center;
  justify-content: center;
}
.jar-kind { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.jar-card h2 { margin-top: 22px; font-size: clamp(24px, 2.6vw, 32px); font-weight: 800; }
.jar-text { margin: 10px 0 22px; font-size: 15px; font-weight: 500; line-height: 1.55; }
.jar-btn {
  width: 100%;
  min-height: 54px;
  font-size: 16px;
  background: var(--ink);
  border-color: var(--ink);
  color: var(--paper);
}
.jar-btn:hover { background: var(--ink); border-color: var(--ink); box-shadow: 4px 4px 0 var(--paper); }
.jar-url {
  display: block;
  margin-top: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  opacity: 0.75;
  word-break: break-all;
}

/* --- crypto --- */
.crypto-text { margin: -6px 0 18px; color: var(--text-1); font-size: 15px; }
.wallets {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wallet {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 14px 14px 16px;
  background: var(--bg-1);
  border: var(--stroke) solid var(--line);
  border-radius: var(--radius-lg);
  transition: border-color var(--dur-fast), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.wallet:hover { border-color: var(--line-strong); }
.wallet.copied { border-color: var(--acid); transform: translate(-3px, -3px); box-shadow: 5px 5px 0 var(--acid); }
.w-main { flex: 1; min-width: 0; }
.w-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.w-net { font-weight: 700; font-size: 15px; }
.w-tag {
  padding: 2px 6px 1px;
  border: 1.5px solid var(--line-strong);
  border-radius: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-1);
}
.w-addr {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-0);
  word-break: break-all;
  line-height: 1.45;
  user-select: all;
}
.w-copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: var(--stroke) solid var(--line-strong);
  background: var(--bg-2);
  color: var(--text-0);
  font-size: 13px;
  font-weight: 700;
  transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}
.w-copy:hover { border-color: var(--paper); }
.w-copy.ok { background: var(--acid); border-color: var(--acid); color: var(--ink); }
.w-copy.bad { border-color: var(--st-dropped); color: var(--st-dropped); }

.note {
  display: flex;
  gap: 12px;
  margin: 20px 0 0;
  padding: 14px 16px;
  border: var(--stroke) dashed var(--st-planned);
  border-radius: var(--radius-md);
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.55;
}
.note-icon { color: var(--st-planned); margin-top: 1px; }

.thanks {
  margin: 48px 0 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(20px, 2.4vw, 28px);
  letter-spacing: -0.02em;
  color: var(--text-2);
}

@media (max-width: 900px) {
  .d-grid { grid-template-columns: 1fr; }
  .jar-card { position: static; box-shadow: 6px 6px 0 var(--paper); }
}

@media (max-width: 560px) {
  .wallet { flex-wrap: wrap; padding: 14px; }
  .w-main { flex-basis: calc(100% - 60px); }
  .w-copy { width: 100%; justify-content: center; }
  .w-addr { font-size: 12px; }
}
</style>
