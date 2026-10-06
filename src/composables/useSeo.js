import { watchEffect } from 'vue'
import { i18n } from '../i18n'

const SITE = 'https://game-shelfed.pp.ua'
const SITE_NAME = 'Game Shelfed'
const DEFAULT_IMAGE = `${SITE}/og-cover.png`

function setMeta(selector, attr, content) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    const [, prop, value] = selector.match(/\[(\w+)="([^"]+)"\]/)
    el.setAttribute(prop, value)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, content)
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd(id, data) {
  let el = document.head.querySelector(`script[data-jsonld="${id}"]`)
  if (!data) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute('data-jsonld', id)
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

// Client-side only (no SSR here), so this mainly helps: browser tab/history
// titles, Googlebot (which does execute JS when indexing), and correct
// canonical/OG values for anyone inspecting the live DOM. Chat apps that
// preview links (Discord/Telegram/Twitter) don't run JS, so they always see
// the static defaults baked into index.html -- true per-page share previews
// would need real SSR/prerendering.
export function useSeo(getMeta) {
  watchEffect(() => {
    const m = getMeta()
    if (!m) return

    const { t } = i18n.global
    const title = m.title ? `${m.title} · ${SITE_NAME}` : t('seo.title')
    const description = m.description || t('seo.description')
    const url = m.path ? `${SITE}${m.path}` : SITE
    const image = m.image || DEFAULT_IMAGE

    document.title = title
    setMeta('meta[name="description"]', 'content', description)
    setLink('canonical', url)

    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[property="og:image"]', 'content', image)

    setMeta('meta[name="twitter:title"]', 'content', title)
    setMeta('meta[name="twitter:description"]', 'content', description)
    setMeta('meta[name="twitter:image"]', 'content', image)

    setMeta('meta[name="robots"]', 'content', m.noindex ? 'noindex, follow' : 'index, follow')

    setJsonLd('page', m.jsonLd || null)
  })
}
