// Optional ad-platform tags: Google Analytics 4, Google Ads and the Meta
// Pixel. Each one switches on only when its id is set in the build env
// (VITE_GA_ID, VITE_GADS_ID + VITE_GADS_SIGNUP_LABEL, VITE_META_PIXEL_ID),
// and nothing loads until the visitor agrees in the cookie banner.

const GA_ID = import.meta.env.VITE_GA_ID || ''
const GADS_ID = import.meta.env.VITE_GADS_ID || ''
const GADS_SIGNUP_LABEL = import.meta.env.VITE_GADS_SIGNUP_LABEL || ''
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || ''

const CONSENT_KEY = 'gs_consent'
// same key the visit counter sets for the site owner (stores/pageViews.js);
// read directly here to keep this module free of store imports
const OWNER_KEY = 'gs_owner'

export const adsConfigured = !!(GA_ID || GADS_ID || META_PIXEL_ID)

let loaded = false
let lastPath = null

function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode etc. */ }
}

// the owner's own browsing and local development stay out of ad stats
function excluded() {
  const h = location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || storageGet(OWNER_KEY) === '1'
}

export function consentChoice() {
  const v = storageGet(CONSENT_KEY)
  return v === 'yes' || v === 'no' ? v : null
}

export function needsConsent() {
  return adsConfigured && !excluded() && consentChoice() === null
}

export function setConsent(agreed) {
  storageSet(CONSENT_KEY, agreed ? 'yes' : 'no')
  if (agreed) loadTrackers()
}

// call once at startup: loads the tags right away for people who agreed before
export function initAds() {
  if (adsConfigured && !excluded() && consentChoice() === 'yes') loadTrackers()
}

function loadScript(src) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

function loadTrackers() {
  if (loaded || excluded()) return
  loaded = true
  lastPath = location.pathname

  if (GA_ID || GADS_ID) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag('consent', 'default', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    })
    window.gtag('js', new Date())
    if (GA_ID) window.gtag('config', GA_ID)
    if (GADS_ID) window.gtag('config', GADS_ID)
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID || GADS_ID)}`)
  }

  if (META_PIXEL_ID) {
    // Meta's standard loader stub: queues calls until fbevents.js arrives
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments)
    }
    if (!window._fbq) window._fbq = fbq
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    loadScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_PIXEL_ID)
    window.fbq('track', 'PageView')
  }
}

// GA4 notices SPA navigation by itself; the Meta Pixel needs telling
export function trackPageView(path) {
  if (!loaded || path === lastPath) return
  lastPath = path
  if (window.fbq) window.fbq('track', 'PageView')
}

// the conversion ads are optimised for: a new account
export function trackSignup(method) {
  if (!loaded) return
  if (window.gtag) {
    if (GA_ID) window.gtag('event', 'sign_up', { method })
    if (GADS_ID && GADS_SIGNUP_LABEL) window.gtag('event', 'conversion', { send_to: `${GADS_ID}/${GADS_SIGNUP_LABEL}` })
  }
  if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: method })
}
