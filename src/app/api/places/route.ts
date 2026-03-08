import { NextResponse } from 'next/server'
import { FEATURED_PLACES } from '@/data/featured-places'

const CHAINS = [
  'mcdonald','kfc','burger king','starbucks','pizza hut','subway',
  'dominos','cafe de coral','大家樂','fairwood','大快活','maxim','美心',
  'yoshinoya','吉野家','pacific coffee','pret','shake shack','five guys',
  'costa','tim horton','jollibee','popeyes','crystal jade','翠園',
  'tai hing','太興','spaghetti house','genki sushi','元氣壽司',
  'ichiran','ippudo','din tai fung','鼎泰豐','haidilao','海底撈',
  'papa john','nando','wagamama','pizza express','outback','hard rock',
  'tony roma','superstar seafood','jumbo kingdom','hotpot party',
  'the alley','gong cha','tiger sugar','heytea','一點點',
  'kung fu tea','chatime','coco','happy lemon','mixue',
  'tsui wah','翠華','tam jai','譚仔','sushiro','壽司郎','yifang',
  'meet fresh','鮮芋仙','hui lau shan','許留山','7-eleven','circle k',
  'wellcome','parknshop','mos burger','lotteria','toast box','ya kun',
  'dunkin','krispy kreme','taco bell','wendy','coffee bean',
]

// HK-specific authenticity keywords — cha chaan tengs, noodle shops, family spots
const HK_AUTHENTIC_KEYWORDS = [
  '記','家','仔','佬','嫂','叔','茶餐廳','粉麵','燒臘',
  '雲吞','牛腩','魚蛋','腸粉','粥','飯','麵',
  'kee','hing','fung','lau',
  'cha chaan teng','congee','noodle','wonton','roast','bbq','brisket','curry fish balls',
]

function isChain(name: string): boolean {
  const lower = name.toLowerCase()
  return CHAINS.some(c => lower.includes(c))
}

function getGemScore(p: any): number {
  let score = 0
  const count = p.userRatingCount ?? 9999
  const rating = p.rating ?? 0

  // Review count brackets
  if (count < 8) {
    if (rating >= 4.5) score += 5   // very new but exceptional
    else score -= 20                 // too few reviews and not exceptional
  } else if (count <= 100) score += 40
  else if (count <= 300) score += 28
  else if (count <= 700) score += 15
  else if (count <= 1500) score += 5
  else score -= 15

  // Rating
  if (rating >= 4.6) score += 28
  else if (rating >= 4.4) score += 20
  else if (rating >= 4.2) score += 12
  else if (rating >= 4.0) score += 5

  // Has editorial summary (Google writes these for notable local spots)
  if (p.editorialSummary?.text) score += 18

  // Non-generic primary type = more specialised / local
  if (p.primaryTypeDisplayName?.text?.toLowerCase() !== 'restaurant') score += 8

  // HK-specific authenticity keywords in name
  const nameLower = (p.displayName?.text ?? '').toLowerCase()
  const hasAuthenticKeyword = HK_AUTHENTIC_KEYWORDS.some(k => nameLower.includes(k.toLowerCase()))
  if (hasAuthenticKeyword) score += 20

  // No website = more likely a local cash-only hole-in-the-wall
  if (!p.websiteUri) score += 15

  // Affordable price level = local spot, not tourist-facing
  // Google Places (New) API returns price level as a string enum
  if (p.priceLevel === 'PRICE_LEVEL_INEXPENSIVE') score += 20
  else if (p.priceLevel === 'PRICE_LEVEL_MODERATE') score += 10

  return score
}

function getDistrict(address: string): string {
  const districts = [
    'Central','Sheung Wan','Wan Chai','Causeway Bay',
    'Kennedy Town','Sai Ying Pun','Admiralty','Happy Valley','North Point',
    'Quarry Bay','Tai Koo','Sai Kung','Tsim Sha Tsui','TST','Jordan',
    'Mong Kok','Yau Ma Tei','Sham Shui Po','Aberdeen','Stanley',
    'Repulse Bay','Tung Chung','Lantau',
  ]
  for (const d of districts) {
    if (address.includes(d)) return d
  }
  const parts = address.split(',')
  return parts.length >= 2 ? parts[parts.length - 2].trim() : 'Hong Kong'
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
}

const FIELD_MASK = [
  'places.id','places.displayName','places.rating',
  'places.userRatingCount','places.priceLevel','places.photos',
  'places.formattedAddress','places.regularOpeningHours',
  'places.primaryTypeDisplayName','places.editorialSummary',
  'places.websiteUri','places.location',
].join(',')

// Three type groups to maximise variety in results
const TYPE_GROUPS = [
  // Local Chinese: cha chaan tengs, dim sum, noodle shops, bakeries
  ['chinese_restaurant', 'dim_sum_restaurant', 'noodle_restaurant', 'bakery'],
  // Cafes and casual: milk tea shops, takeaway, desserts
  ['cafe', 'meal_takeaway', 'sandwich_shop', 'dessert_shop'],
  // Other Asian: Japanese, Korean, Thai, Vietnamese
  ['japanese_restaurant', 'korean_restaurant', 'thai_restaurant', 'vietnamese_restaurant'],
]

async function fetchGroup(
  types: string[],
  lat: number,
  lng: number,
  radiusMetres: number,
  apiKey: string
): Promise<any[]> {
  try {
    const res = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMetres,
            },
          },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('GOOGLE GROUP ERROR:', types[0], JSON.stringify(err))
      return []
    }
    const data = await res.json()
    return data.places ?? []
  } catch (e: any) {
    console.error('GOOGLE GROUP CRASH:', types[0], e.message)
    return []
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: Request) {
  console.log('PLACES START')
  try {
    const body = await req.json()
    const { lat, lng, radiusMetres = 2000, alreadySwiped = [] } = body
    console.log('PLACES coords:', lat, lng, 'radius:', radiusMetres)
    console.log('API KEY EXISTS:', !!process.env.GOOGLE_PLACES_API_KEY)

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || ''

    // Parallel fetch across all 3 type groups
    const groupResults = await Promise.all(
      TYPE_GROUPS.map(types => fetchGroup(types, lat, lng, radiusMetres, apiKey))
    )

    // Merge and deduplicate by place id
    const seen = new Set<string>()
    const raw: any[] = []
    for (const group of groupResults) {
      for (const place of group) {
        if (!seen.has(place.id)) {
          seen.add(place.id)
          raw.push(place)
        }
      }
    }
    console.log('RAW COUNT (merged, deduped):', raw.length)

    // 1. Remove chains — always
    const noChains = raw.filter((p: any) => {
      const name = p.displayName?.text ?? ''
      const chain = isChain(name)
      if (chain) console.log('REMOVED CHAIN:', name)
      return !chain
    })
    console.log('AFTER CHAIN REMOVAL:', noChains.length)

    // 2. Remove already swiped
    const notSwiped = noChains.filter((p: any) => !alreadySwiped.includes(p.id))

    // 3. Quality filter — lowered minimum to 8 reviews to catch ultra-hidden spots
    const quality = notSwiped.filter((p: any) =>
      (p.rating ?? 0) >= 3.8 &&
      (p.userRatingCount ?? 0) >= 8 &&
      (p.userRatingCount ?? 9999) <= 4000
    )
    console.log('AFTER QUALITY FILTER:', quality.length)

    // 4. Use quality results, fallback to chain-free if too few
    const pool = quality.length >= 4 ? quality : notSwiped.filter((p: any) =>
      (p.rating ?? 0) >= 3.5 && !isChain(p.displayName?.text ?? '')
    )
    console.log('POOL SIZE:', pool.length)

    // 5. Score and sort
    const scored = pool
      .map((p: any) => ({ ...p, gemScore: getGemScore(p) }))
      .sort((a: any, b: any) => b.gemScore - a.gemScore)

    // 6. Transform to PlaceResult shape
    const places = scored.map((p: any) => ({
      id: p.id,
      name: p.displayName?.text ?? 'Unknown',
      chineseName: null,
      rating: p.rating ?? 0,
      reviewCount: p.userRatingCount ?? 0,
      priceLevel: p.priceLevel ?? null,
      priceLabel: PRICE_MAP[p.priceLevel ?? ''] ?? '$$',
      address: p.formattedAddress ?? '',
      districtName: getDistrict(p.formattedAddress ?? ''),
      photoName: p.photos?.[0]?.name ?? null,
      openNow: p.regularOpeningHours?.openNow ?? null,
      cuisineTypes: p.primaryTypeDisplayName?.text ? [p.primaryTypeDisplayName.text] : [],
      editorialSummary: p.editorialSummary?.text ?? null,
      hidden_gem: getGemScore(p) >= 30,
      gemScore: p.gemScore,
      isFeatured: false,
      lat: p.location?.latitude ?? lat,
      lng: p.location?.longitude ?? lng,
    }))

    // Inject nearby featured places (not already swiped) at fixed positions
    const radiusKm = radiusMetres / 1000
    const nearbyFeatured = FEATURED_PLACES.filter(f =>
      !alreadySwiped.includes(f.id) &&
      !places.some(p => p.id === f.id) &&
      haversineKm(lat, lng, f.lat, f.lng) <= Math.max(radiusKm * 2, 10)
    )
    // Inject at positions 3, 9, 17 (0-indexed 2, 8, 16)
    const INJECT_POSITIONS = [2, 8, 16]
    const final: any[] = [...places]
    let injected = 0
    for (const pos of INJECT_POSITIONS) {
      if (injected >= nearbyFeatured.length) break
      const insertAt = Math.min(pos, final.length)
      final.splice(insertAt, 0, nearbyFeatured[injected])
      injected++
    }

    console.log('FINAL RETURNED:', final.length, '(featured injected:', injected, ')')
    return NextResponse.json({ places: final })

  } catch (e: any) {
    console.error('PLACES CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
