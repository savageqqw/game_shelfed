import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import uk from './locales/uk.json'
import ru from './locales/ru.json'

const saved = localStorage.getItem('gl_lang')
const browser = navigator.language?.slice(0, 2)
const initial = saved || (['uk', 'ru', 'en'].includes(browser) ? browser : 'uk')

export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: 'en',
  messages: { en, uk, ru }
})

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('gl_lang', locale)
  document.documentElement.setAttribute('lang', locale)
}
