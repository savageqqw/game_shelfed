import { sendJson, withErrors } from './_utils/response.js'

const PAGE_SIZE = 24
const CANDIDATE_POOL = 200

// Cached across warm invocations of this function instance.
let cachedToken = null
let cachedExpiry = 0

async function getAppToken() {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken

  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    const err = new Error(
      'IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are not configured. Create a free app at dev.twitch.tv/console/apps and set both in Vercel env vars.'
    )
    err.statusCode = 500
    throw err
  }

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')

  const res = await fetch(tokenUrl, { method: 'POST' })
  if (!res.ok) {
    const err = new Error('Failed to authenticate with the game catalog provider')
    err.statusCode = 502
    throw err
  }
  const data = await res.json()
  cachedToken = data.access_token
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

function escapeQuery(q) {
  return q.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

const CYRILLIC_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', є: 'ye', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

function hasCyrillic(s) {
  return /[\u0400-\u04FF]/.test(s)
}

// Rough letter-by-letter reversal of the phonetic borrowing gamers use when
// typing English titles in Cyrillic (e.g. "край" for the "cry" sound).
// Cheap and fast, but literal — doesn't fix cases where the Cyrillic spelling
// doesn't map 1:1 onto the original English letters (see translateToEnglish).
function transliterate(s) {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => (CYRILLIC_MAP[ch] !== undefined ? CYRILLIC_MAP[ch] : ch))
    .join('')
}

// Fallback for when transliteration doesn't produce a real English word
// (e.g. "фар край" -> "far kray", not "far cry"). Machine translators tend
// to recognize well-known game/brand names from their training data and
// often return the correct real title instead of a literal translation.
async function translateToEnglish(text) {
  for (const source of ['ru', 'uk']) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|en`
      const r = await fetch(url)
      if (!r.ok) continue
      const data = await r.json()
      const translated = data?.responseData?.translatedText
      if (translated && !/NO QUERY|INVALID|MYMEMORY WARNING/i.test(translated) && translated.toLowerCase() !== text.toLowerCase()) {
        return translated
      }
    } catch {
      // try next source language
    }
  }
  return null
}

async function igdbFetch(path, body, clientId, token) {
  const res = await fetch(`https://api.igdb.com/v4/${path}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body
  })
  if (!res.ok) {
    const err = new Error('Failed to reach the game catalog provider')
    err.statusCode = res.status
    throw err
  }
  return res.json()
}

async function searchCandidates(term, fields, clientId, token) {
  const body = `search "${escapeQuery(term)}"; where version_parent = null; fields ${fields}; limit ${CANDIDATE_POOL};`
  const candidates = await igdbFetch('games', body, clientId, token)
  return (candidates || []).slice().sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const clientId = process.env.IGDB_CLIENT_ID
  const token = await getAppToken()

  const params = req.query || {}
  const rawQ = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const offset = (page - 1) * PAGE_SIZE
  const fields = 'id,name,cover.url,rating,first_release_date,genres.name,total_rating_count'

  let games
  let hasMore
  let count

  if (rawQ) {
    const isCyr = hasCyrillic(rawQ)
    const firstTry = isCyr ? transliterate(rawQ) : rawQ

    let sorted = await searchCandidates(firstTry, fields, clientId, token)

    // Literal transliteration found nothing — try a translation service,
    // which often recognizes known game/brand names correctly.
    if (isCyr && sorted.length === 0) {
      const translated = await translateToEnglish(rawQ)
      if (translated) {
        sorted = await searchCandidates(translated, fields, clientId, token)
      }
    }

    games = sorted.slice(offset, offset + PAGE_SIZE)
    count = sorted.length
    hasMore = offset + PAGE_SIZE < sorted.length
  } else {
    const gamesBody = `fields ${fields}; where version_parent = null; sort total_rating_count desc; limit ${PAGE_SIZE}; offset ${offset};`
    const countBody = 'where version_parent = null;'
    const [gamesRes, countRes] = await Promise.all([
      igdbFetch('games', gamesBody, clientId, token),
      igdbFetch('games/count', countBody, clientId, token)
    ])
    games = gamesRes
    count = countRes?.count || 0
    hasMore = offset + PAGE_SIZE < count
  }

  const results = (games || []).map((g) => ({
    id: g.id,
    title: g.name,
    cover: g.cover?.url ? 'https:' + g.cover.url.replace('t_thumb', 't_cover_big') : null,
    rating: g.rating ? Number((g.rating / 20).toFixed(1)) : null,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    genres: (g.genres || []).map((x) => x.name)
  }))

  sendJson(res, 200, { results, hasMore, count })
})
