import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { captureAttribution } from './utils/attribution'
import { initAds, trackPageView } from './utils/ads'
import './assets/styles/main.css'

// read the landing URL (utm tags, referrer) before the router touches it
captureAttribution()
initAds()
router.afterEach((to) => trackPageView(to.path))

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)

document.documentElement.setAttribute('data-theme', 'dark')
document.documentElement.setAttribute('lang', i18n.global.locale.value)

app.mount('#app')
