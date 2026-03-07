import { NextResponse } from 'next/server';

// ── Chain blocklist ────────────────────────────────────────────────────────────

const CHAIN_BLOCKLIST = [
  // International fast food
  "mcdonald's", 'mcdonalds', 'kfc', 'burger king', 'subway', 'pizza hut',
  'domino', 'papa john', 'popeyes', 'wendy', 'taco bell', 'five guys',
  'shake shack', 'jollibee', 'starbucks', 'coffee bean', 'pacific coffee',
  'dunkin', 'krispy kreme', 'tim hortons',
  // HK local chains (Traditional Chinese + romanised)
  '大家樂', 'cafe de coral', '美心', 'maxim', '大快活', 'fairwood',
  '翠華', 'tsui wah', '稻香', 'tai hing', '太興', '一粥麵',
  '譚仔', 'tam jai', '吉野家', 'yoshinoya', '丼丼亭',
  '壽司郎', 'sushiro', '元氣壽司', 'genki sushi', '爭鮮',
  '天仁茗茶', '貢茶', 'gong cha', '一點點', 'yifang',
  '鮮芋仙', 'meet fresh', '許留山', 'hui lau shan',
  '7-eleven', 'circle k', 'wellcome', 'parknshop',
  'mos burger', 'lotteria', 'toast box', 'ya kun',
];

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_BLOCKLIST.some((c) => lower.includes(c));
}

// ── HK district lookup ────────────────────────────────────────────────────────

const HK_DISTRICTS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Central',        lat: 22.2814, lng: 114.1571 },
  { name: 'Wan Chai',       lat: 22.2797, lng: 114.1718 },
  { name: 'Causeway Bay',   lat: 22.2805, lng: 114.1830 },
  { name: 'Sheung Wan',     lat: 22.2868, lng: 114.1516 },
  { name: 'Kennedy Town',   lat: 22.2806, lng: 114.1283 },
  { name: 'Admiralty',      lat: 22.2793, lng: 114.1658 },
  { name: 'Sai Ying Pun',   lat: 22.2857, lng: 114.1430 },
  { name: 'North Point',    lat: 22.2912, lng: 114.1991 },
  { name: 'Quarry Bay',     lat: 22.2877, lng: 114.2147 },
  { name: 'Tai Koo',        lat: 22.2841, lng: 114.2229 },
  { name: 'Tsim Sha Tsui',  lat: 22.2989, lng: 114.1722 },
  { name: 'Mong Kok',       lat: 22.3193, lng: 114.1694 },
  { name: 'Yau Ma Tei',     lat: 22.3121, lng: 114.1700 },
  { name: 'Jordan',         lat: 22.3047, lng: 114.1713 },
  { name: 'Sham Shui Po',   lat: 22.3309, lng: 114.1622 },
  { name: 'Wong Tai Sin',   lat: 22.3419, lng: 114.1930 },
  { name: 'Kwun Tong',      lat: 22.3131, lng: 114.2259 },
  { name: 'Kowloon Bay',    lat: 22.3239, lng: 114.2117 },
  { name: 'Tuen Mun',       lat: 22.3920, lng: 113.9770 },
  { name: 'Sha Tin',        lat: 22.3853, lng: 114.1876 },
];

function getDistrict(lat: number, lng: number): string | null {
  let nearest = null;
  let minDist = Infinity;
  for (const d of HK_DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lng - lng);
    if (dist < minDist) { minDist = dist; nearest = d.name; }
  }
  return minDist < 0.05 ? nearest : null; // ~5km cutoff
}

// ── Gem scoring ───────────────────────────────────────────────────────────────

const NICHE_TYPES = [
  'dim_sum_restaurant', 'ramen_restaurant', 'izakaya_restaurant',
  'hot_pot_restaurant', 'sushi_restaurant', 'wine_bar',
  'tea_house', 'dessert_shop', 'bakery', 'vietnamese_restaurant',
  'thai_restaurant', 'korean_restaurant', 'french_restaurant',
  'italian_restaurant', 'spanish_restaurant', 'middle_eastern_restaurant',
];

function scorePlace(p: {
  userRatingCount?: number;
  rating?: number;
  editorialSummary?: { text?: string } | null;
  primaryType?: string | null;
}): number {
  let score = 0;
  const count = p.userRatingCount ?? 0;
  const rating = p.rating ?? 0;

  // Review count score (fewer = more hidden)
  if (count < 50)       score += 40;
  else if (count < 150) score += 30;
  else if (count < 300) score += 20;
  else if (count < 600) score += 10;
  else if (count > 800) score -= 20;

  // Rating score
  if (rating >= 4.7)      score += 30;
  else if (rating >= 4.4) score += 22;
  else if (rating >= 4.2) score += 15;
  else if (rating >= 4.0) score += 8;
  else                    score += 3;

  // Editorial summary bonus (Google-curated description = quality signal)
  if (p.editorialSummary?.text) score += 20;

  // Niche primary type bonus
  if (p.primaryType && NICHE_TYPES.includes(p.primaryType)) score += 10;

  return score;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log('PLACES START');
  console.log('KEY EXISTS:', !!process.env.GOOGLE_PLACES_API_KEY);
  console.log('KEY LENGTH:', process.env.GOOGLE_PLACES_API_KEY?.length);

  try {
    const { lat, lng, radiusMetres = 1500, hkHour } = await req.json();
    console.log('PLACES: calling Google', lat, lng, 'radius:', radiusMetres);

    // Build included types based on time of day
    const includedTypes = ['restaurant', 'cafe', 'bar', 'bakery'];
    const hour = hkHour ?? new Date().getHours();
    if (hour < 11) includedTypes.push('dim_sum_restaurant', 'breakfast_restaurant');
    if (hour >= 14 && hour < 18) includedTypes.push('tea_house', 'dessert_shop');
    if (hour >= 22) includedTypes.push('ramen_restaurant', 'izakaya_restaurant');

    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY || '',
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.rating',
          'places.userRatingCount',
          'places.priceLevel',
          'places.photos',
          'places.formattedAddress',
          'places.regularOpeningHours',
          'places.primaryTypeDisplayName',
          'places.primaryType',
          'places.editorialSummary',
          'places.location',
        ].join(','),
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(radiusMetres, 50000),
          },
        },
      }),
    });

    console.log('GOOGLE STATUS:', res.status);
    const data = await res.json();
    const raw: any[] = data.places ?? [];
    console.log('GOOGLE COUNT:', raw.length);

    // Step 1: Chain filter
    const afterChain = raw.filter((p) => !isChain(p.displayName?.text ?? ''));
    console.log('AFTER CHAIN FILTER:', afterChain.length);

    // Step 2: Quality filter
    const applyQualityFilter = (items: any[]) =>
      items.filter((p) => {
        const count = p.userRatingCount ?? 0;
        const rating = p.rating ?? 0;
        return rating >= 3.9 && count >= 15 && count <= 3000;
      });

    let filtered = applyQualityFilter(afterChain);
    console.log('AFTER QUALITY FILTER:', filtered.length);

    // Fallback: if < 5 results, relax quality filter but keep chain filter
    if (filtered.length < 5) {
      console.log('FALLBACK: relaxing quality filter');
      filtered = afterChain.filter((p) => (p.rating ?? 0) >= 3.5);
      console.log('AFTER FALLBACK FILTER:', filtered.length);
    }

    // Step 3: Score each place
    const scored = filtered.map((p) => ({
      raw: p,
      gemScore: scorePlace(p),
    }));

    // Step 4: Sort by gemScore descending
    scored.sort((a, b) => b.gemScore - a.gemScore);

    // Step 5: Map to PlaceResult
    const places = scored.map(({ raw: p, gemScore }) => {
      const placeLat = p.location?.latitude ?? lat;
      const placeLng = p.location?.longitude ?? lng;

      const priceMap: Record<string, string> = {
        PRICE_LEVEL_FREE: 'Free',
        PRICE_LEVEL_INEXPENSIVE: '$',
        PRICE_LEVEL_MODERATE: '$$',
        PRICE_LEVEL_EXPENSIVE: '$$$',
        PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
      };

      return {
        id: p.id,
        name: p.displayName?.text ?? 'Unknown',
        chineseName: null,
        rating: p.rating ?? 0,
        reviewCount: p.userRatingCount ?? 0,
        priceLevel: p.priceLevel ?? null,
        priceLabel: priceMap[p.priceLevel ?? ''] ?? '$$',
        address: p.formattedAddress ?? '',
        photoName: p.photos?.[0]?.name ?? null,
        openNow: p.regularOpeningHours?.openNow ?? null,
        cuisineTypes: p.primaryTypeDisplayName?.text ? [p.primaryTypeDisplayName.text] : [],
        editorialSummary: p.editorialSummary?.text ?? null,
        hidden_gem: gemScore >= 35,
        gemScore,
        districtName: getDistrict(placeLat, placeLng),
        lat: placeLat,
        lng: placeLng,
      };
    });

    console.log('FINAL RETURNED:', places.length, 'hidden gems:', places.filter((p) => p.hidden_gem).length);
    return NextResponse.json({ places });

  } catch (e: unknown) {
    const err = e as Error;
    console.error('PLACES ERROR:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
