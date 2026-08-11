# Game Shelfed

SPA для обліку пройдених ігор: величезний каталог для пошуку (через IGDB/Twitch), особиста полиця з категоріями «В планах / Граю / Пройдено / Кинуто», реєстрація та вхід, темна/світла тема, три мови (укр/eng/рос). Фронтенд — Vue 3 + Vite, бекенд — Vercel Serverless Functions + Turso (libSQL).

## Архітектура

```
src/            Vue SPA (Pinia + vue-router + vue-i18n)
api/            Serverless бекенд (Node, ESM) — розгортається Vercel автоматично
db/schema.sql   Довідкова схема БД (застосовується автоматично при першому запиті)
```

Vercel не хостить постійний Express-сервер — тому весь бекенд написаний як окремі serverless-функції в `api/`, кожен файл — свій ендпоінт (`api/auth-login.js` → `/api/auth-login` і так далі). Фронтенд ходить на них через `/api/*` як в дев-режимі, так і в проді.

## Що потрібно налаштувати перед деплоєм

1. **Turso (база даних)** — безкоштовно на [turso.tech](https://turso.tech).
   ```
   turso db create game-shelfed
   turso db show game-shelfed --url          # → TURSO_DATABASE_URL
   turso db tokens create game-shelfed        # → TURSO_AUTH_TOKEN
   ```
   Таблиці створюються самі при першому запиті (див. `api/_utils/db.js`), ручний запуск `db/schema.sql` не обов'язковий.

2. **IGDB (каталог ігор, через Twitch)** — безкоштовно й миттєво, без черги схвалення:
   - Заходиш на [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) з будь-яким Twitch-акаунтом
   - **Register Your Application** → назва будь-яка, OAuth Redirect URL: `https://localhost`, Category: `Application Integration`
   - Копіюєш **Client ID**, тиснеш **New Secret** → копіюєш **Client Secret**
   - Це значення `IGDB_CLIENT_ID` і `IGDB_CLIENT_SECRET`

3. **JWT_SECRET** — будь-який довгий випадковий рядок (наприклад `openssl rand -hex 32`).

4. **STEAM_API_KEY** (для входу через Steam і для імпорту бібліотеки) — безкоштовно й миттєво на [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey), домен можна вказати будь-який (наприклад `localhost`).

## Локальний запуск

```bash
npm install -g vercel        # якщо ще не стоїть
npm install
cp .env.example .env         # заповнити реальними значеннями
vercel dev                   # піднімає і фронт, і функції разом (типово на localhost:3000)
```

(`npm run dev` теж працює для самого фронту на Vite, але тоді запити до `/api/*` не проксуються без запущеного окремо `vercel dev` — проксі на порт 3000 вже налаштований у `vite.config.js`.)

## Деплой на Vercel

1. Заливаєш репозиторій на GitHub.
2. На [vercel.com](https://vercel.com): **Add New → Project**, обираєш репозиторій. Vercel сам розпізнає Vite-проєкт і підхопить `vercel.json` (build command, output directory, SPA-редіректи, функції з `api/`).
3. В **Project Settings → Environment Variables** додаєш змінні з `.env.example`: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `STEAM_API_KEY`.
4. Деплой → готово. SPA-роутинг (сторінки `/my-games`, `/login` тощо при прямому переході) вже налаштований через `rewrites` у `vercel.json`.

Безкоштовний план Vercel (Hobby) не потребує картки і повністю покриває цей проєкт: статичний хостинг, serverless-функції з щедрими лімітами запитів, автодеплой з GitHub.

## Категорії статусів

`planned` (в планах) · `playing` (граю) · `completed` (пройдено) · `dropped` (кинуто) — заведені як enum на бекенді (`api/library-upsert.js`), легко розширити своїми категоріями там і в `src/stores/library.js` / файлах локалізації.

## Мови й теми

- Локалізація: `src/i18n/locales/{en,uk,ru}.json`, перемикач — `LangSwitcher.vue`, авто-визначення мови браузера при першому заході.
- Тема: CSS-змінні в `src/assets/styles/main.css` (`[data-theme='dark']` / `[data-theme='light']`), перемикач — `ThemeToggle.vue`, зберігається в localStorage.
