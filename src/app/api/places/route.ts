import { NextResponse } from 'next/server'

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
  // extras from previous version
  'tsui wah','翠華','tam jai','譚仔','sushiro','壽司郎','yifang',
  'meet fresh','鮮芋仙','hui lau shan','許留山','7-eleven','circle k',
  'wellcome','parknshop','mos burger','lotteria','toast box','ya kun',
  'dunkin','krispy kreme','taco bell','wendy','popeyes','coffee bean',
]

function isChain(name: string): boolean {
  const lower = name.toLowerCase()
  return CHAINS.some(c => lower.includes(c))
}

function getGemScore(p: any): number {
  let score = 0
  const count = p.userRatingCount ?? 9999
  const rating = p.rating ?? 0
  if (count <= 100) score += 40
  else if (count <= 300) score += 28
  else if (count <= 700) score += 15
  else if (count <= 1500) score += 5
  else score -= 15
  if (rating >= 4.6) score += 28
  else if (rating >= 4.4) score += 20
  else if (rating >= 4.2) score += 12
  else if (rating >= 4.0) score += 5
  if (p.editorialSummary?.text) score += 18
  if (p.primaryTypeDisplayName?.text?.toLowerCase() !== 'restaurant') score += 8
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

export async function POST(req: Request) {
  console.log('PLACES START')
  try {
    const body = await req.json()
    const { lat, lng, radiusMetres = 2000, alreadySwiped = [] } = body
    console.log('PLACES coords:', lat, lng, 'radius:', radiusMetres)
    console.log('API KEY EXISTS:', !!process.env.GOOGLE_PLACES_API_KEY)

    const googleRes = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY || '',
          'X-Goog-FieldMask': [
            'places.id','places.displayName','places.rating',
            'places.userRatingCount','places.priceLevel','places.photos',
            'places.formattedAddress','places.regularOpeningHours',
            'places.primaryTypeDisplayName','places.editorialSummary',
            'places.websiteUri','places.location',
          ].join(','),
        },
        body: JSON.stringify({
          includedTypes: ['restaurant','cafe','bar','bakery'],
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

    console.log('GOOGLE STATUS:', googleRes.status)
    const data = await googleRes.json()
    const raw: any[] = data.places ?? []
    console.log('RAW COUNT:', raw.length)

    if (!googleRes.ok) {
      console.error('GOOGLE ERROR:', JSON.stringify(data))
      return NextResponse.json({ error: 'Google error', detail: data }, { status: 500 })
    }

    // STEP 1: Remove chains — ALWAYS
    const noChains = raw.filter((p: any) => {
      const name = p.displayName?.text ?? ''
      const chain = isChain(name)
      if (chain) console.log('REMOVED CHAIN:', name)
      return !chain
    })
    console.log('AFTER CHAIN REMOVAL:', noChains.length)

    // STEP 2: Remove already swiped
    const notSwiped = noChains.filter((p: any) => !alreadySwiped.includes(p.id))

    // STEP 3: Quality filter
    const quality = notSwiped.filter((p: any) =>
      (p.rating ?? 0) >= 3.8 &&
      (p.userRatingCount ?? 0) >= 10 &&
      (p.userRatingCount ?? 9999) <= 4000
    )
    console.log('AFTER QUALITY FILTER:', quality.length)

    // STEP 4: Use quality results, fallback to notSwiped (chain-free) if too few
    const pool = quality.length >= 4 ? quality : notSwiped.filter((p: any) =>
      (p.rating ?? 0) >= 3.5 && !isChain(p.displayName?.text ?? '')
    )
    console.log('POOL SIZE:', pool.length)

    // STEP 5: Score and sort
    const scored = pool
      .map((p: any) => ({ ...p, gemScore: getGemScore(p) }))
      .sort((a: any, b: any) => b.gemScore - a.gemScore)

    // STEP 6: Transform to PlaceResult shape (matches SwipeCard + session page)
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

    console.log('FINAL RETURNED:', places.length)
    return NextResponse.json({ places })

  } catch (e: any) {
    console.error('PLACES CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
