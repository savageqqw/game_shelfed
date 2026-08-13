const CONCURRENCY = 6

// Steam's own store-search + appdetails endpoints are public and need no
// API key. storesearch ranks by relevance, so we just take its top hit.
async function resolveAppId(title) {
  const url = new URL('https://store.steampowered.com/api/storesearch/')
  url.searchParams.set('term', title)
  url.searchParams.set('cc', 'us')
  url.searchParams.set('l', 'english')
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const data = await r.json()
    const hit = data?.items?.[0]
    return hit?.id ?? null
  } catch {
    return null
  }
}

async function fetchDiscount(appid) {
  const url = new URL('https://store.steampowered.com/api/appdetails')
  url.searchParams.set('appids', String(appid))
  url.searchParams.set('cc', 'us')
  url.searchParams.set('filters', 'price_overview')
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const data = await r.json()
    const entry = data?.[String(appid)]
    if (!entry?.success) return null
    const price = entry.data?.price_overview
    if (!price) return null // free or not for sale in this region
    return {
      discountPercent: price.discount_percent || 0,
      finalPrice: price.final_formatted,
      initialPrice: price.initial_formatted,
      currency: price.currency
    }
  } catch {
    return null
  }
}

async function checkOne(item) {
  let appid = null
  if (String(item.game_id).startsWith('steam:')) {
    appid = parseInt(String(item.game_id).slice('steam:'.length), 10)
  } else {
    appid = await resolveAppId(item.title)
  }
  if (!appid) return null

  const price = await fetchDiscount(appid)
  if (!price || !price.discountPercent) return null

  return {
    game_id: item.game_id,
    title: item.title,
    cover: item.cover,
    appid,
    ...price
  }
}

// Checks a list of {game_id, title, cover} planned-library rows against
// current Steam pricing and returns only those at/above the discount
// threshold, sorted best-discount-first.
export async function findDeals(items, threshold) {
  const deals = []
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const slice = items.slice(i, i + CONCURRENCY)
    const settled = await Promise.all(slice.map(checkOne))
    for (const d of settled) {
      if (d && d.discountPercent >= threshold) deals.push(d)
    }
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent)
  return deals
}
