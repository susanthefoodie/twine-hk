import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { PlaceResult } from '@/types/place';

// ── Constants ────────────────────────────────────────────────────────────────

const CHAIN_BLOCKLIST = [
  "McDonald", "KFC", "Burger King", "Starbucks", "Pizza Hut", "Subway",
  "Domino", "Cafe de Coral", "Fairwood", "Maxim", "美心", "大家樂", "大快活",
  "Yoshinoya", "Pacific Coffee", "Pret", "Oliver",
];

const CUISINE_TYPE_MAP: Record<string, string[]> = {
  cantonese:    ['chinese_restaurant'],
  japanese:     ['japanese_restaurant'],
  korean:       ['korean_restaurant'],
  italian:      ['italian_restaurant'],
  western:      ['american_restaurant', 'steak_house'],
  thai:         ['thai_restaurant'],
  indian:       ['indian_restaurant'],
  vietnamese:   ['vietnamese_restaurant'],
  seafood:      ['seafood_restaurant'],
  hotpot:       ['chinese_restaurant'],
  dim_sum:      ['chinese_restaurant'],
  ramen:        ['ramen_restaurant', 'japanese_restaurant'],
  sushi:        ['sushi_restaurant', 'japanese_restaurant'],
  vegetarian:   ['vegetarian_restaurant'],
};

const PRICE_LABELS: Record<number, string> = {
  0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$',
};

// ── Time-of-day type additions ────────────────────────────────────────────────

function timeOfDayTypes(hkHour: number): string[] {
  if (hkHour >= 5 && hkHour < 11) {
    return ['dim_sum_restaurant', 'breakfast_restaurant'];
  }
  if (hkHour >= 14 && hkHour < 17.5) {
    return ['cafe', 'tea_house'];
  }
  if (hkHour >= 22 || hkHour < 5) {
    return ['bar', 'ramen_restaurant', 'izakaya_restaurant'];
  }
  return [];
}

// ── Gem scoring ───────────────────────────────────────────────────────────────

function gemScore(place: GooglePlace, hkHour: number): number {
  let score = 0;
  const count  = place.userRatingCount ?? 0;
  const rating = place.rating ?? 0;
  const name   = place.displayName?.text ?? '';

  if (count < 300)  score += 20;
  if (place.editorialSummary?.text) score += 15;
  if (rating >= 4.2) score += 10;
  if (
    place.types?.some((t) =>
      ['ramen_restaurant', 'sushi_restaurant', 'seafood_restaurant',
       'korean_restaurant', 'vietnamese_restaurant', 'indian_restaurant'].includes(t)
    )
  ) score += 5;
  if (count > 800) score -= 10;

  // Afternoon tea bonus (2pm–5:30pm)
  if (hkHour >= 14 && hkHour < 17.5) {
    if (/tea|茶/i.test(name)) score += 10;
  }

  return score;
}

// ── Google Places types ───────────────────────────────────────────────────────

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  photos?: { name: string }[];
  editorialSummary?: { text: string };
  currentOpeningHours?: { openNow: boolean };
  location?: { latitude: number; longitude: number };
}

interface NearbySearchResponse {
  places?: GooglePlace[];
}

// ── Price normalisation ───────────────────────────────────────────────────────

function normPrice(raw: string | undefined): number {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[raw ?? ''] ?? 0;
}

// ── POST /api/places ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lat: number;
    lng: number;
    radiusMetres: number;
    cuisines?: string[];
    budgetLevels?: number[];
    openNow?: boolean;
    hkHour?: number;
    sessionId?: string;
    alreadySwiped?: string[];
  };

  const { lat, lng, radiusMetres, cuisines, budgetLevels, openNow, alreadySwiped = [] } = body;

  // HK hour: use provided value or derive from server time
  const hkHour = body.hkHour ?? parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false })
  );

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === 'replace_me') {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 503 });
  }

  // Build includedTypes: cuisine selection + time-of-day bonuses
  const typesRaw = cuisines?.length
    ? cuisines.flatMap((c) => CUISINE_TYPE_MAP[c] ?? ['restaurant'])
    : ['restaurant'];
  const timeTypes = timeOfDayTypes(hkHour);
  const includedTypes: string[] = Array.from(new Set([...typesRaw, ...timeTypes]));

  // MTR mode: radiusMetres=99999 means client already passed MTR station coords
  // Use 800m for MTR searches, cap others at 50km
  const searchRadius = radiusMetres === 99999 ? 800 : Math.min(radiusMetres, 50000);

  const searchPayload = {
    includedTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: searchRadius,
      },
    },
    rankPreference: 'POPULARITY',
  };

  const FIELD_MASK = [
    'places.id', 'places.displayName', 'places.formattedAddress',
    'places.rating', 'places.userRatingCount', 'places.priceLevel',
    'places.types', 'places.photos', 'places.editorialSummary',
    'places.currentOpeningHours', 'places.location',
  ].join(',');

  const commonHeaders = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': FIELD_MASK,
  };

  // Fetch English + zh-TW results in parallel
  const [enRes, zhRes] = await Promise.all([
    fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(searchPayload),
    }),
    fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
        'Accept-Language': 'zh-TW',
      },
      body: JSON.stringify({ ...searchPayload, languageCode: 'zh-TW' }),
    }),
  ]);

  if (!enRes.ok) {
    const err = await enRes.text();
    return NextResponse.json({ error: `Google API error: ${err}` }, { status: 502 });
  }

  const enData = (await enRes.json()) as NearbySearchResponse;
  const raw    = enData.places ?? [];

  // Build zh-TW name map: id → chineseName
  const zhNameMap = new Map<string, string>();
  if (zhRes.ok) {
    const zhData = (await zhRes.json()) as { places?: { id: string; displayName?: { text: string } }[] };
    for (const p of zhData.places ?? []) {
      if (p.id && p.displayName?.text) zhNameMap.set(p.id, p.displayName.text);
    }
  }

  // ── Filter: remove chains, out-of-range counts ────────────────────────────

  const filtered = raw.filter((p) => {
    const name  = p.displayName?.text ?? '';
    const count = p.userRatingCount ?? 0;
    if (count > 1200 || count < 30) return false;
    if (CHAIN_BLOCKLIST.some((chain) => name.includes(chain))) return false;
    return true;
  });

  // ── Budget filter ─────────────────────────────────────────────────────────

  const budgetFiltered = budgetLevels?.length
    ? filtered.filter((p) => budgetLevels.includes(normPrice(p.priceLevel)))
    : filtered;

  // ── Open now filter ───────────────────────────────────────────────────────

  const openFiltered = openNow
    ? budgetFiltered.filter((p) => p.currentOpeningHours?.openNow === true)
    : budgetFiltered;

  // ── Score, sort, remove already-swiped ───────────────────────────────────

  const scored = openFiltered
    .map((p) => ({ place: p, score: gemScore(p, hkHour) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ place }) => !alreadySwiped.includes(place.id));

  // ── Transform to PlaceResult ──────────────────────────────────────────────

  const results: PlaceResult[] = scored.map(({ place, score }) => {
    const priceNum   = normPrice(place.priceLevel);
    const enName     = place.displayName?.text ?? 'Unknown';
    const zhName     = zhNameMap.get(place.id) ?? null;
    const chineseName = zhName && zhName !== enName ? zhName : null;

    return {
      id: place.id,
      name: enName,
      chineseName,
      address: place.formattedAddress ?? '',
      rating: place.rating ?? 0,
      reviewCount: place.userRatingCount ?? 0,
      priceLevel: priceNum,
      priceLabel: PRICE_LABELS[priceNum] ?? '$',
      cuisineTypes: place.types ?? [],
      photoName: place.photos?.[0]?.name ?? null,
      editorialSummary: place.editorialSummary?.text ?? null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      gemScore: score,
      hidden_gem: score >= 20,
      lat: place.location?.latitude ?? lat,
      lng: place.location?.longitude ?? lng,
    };
  });

  // ── Inject featured restaurants ───────────────────────────────────────────

  const admin = createAdminClient();
  const { data: featured } = await admin
    .from('featured_restaurants')
    .select('*')
    .eq('active', true)
    .limit(3);

  const featuredPlaces: PlaceResult[] = (featured ?? []).map((f) => ({
    id: `featured_${f.id}`,
    name: f.name,
    chineseName: null,
    address: f.address ?? '',
    rating: f.rating ?? 0,
    reviewCount: f.review_count ?? 0,
    priceLevel: f.price_level ?? 0,
    priceLabel: PRICE_LABELS[f.price_level ?? 0] ?? '$',
    cuisineTypes: f.cuisine_types ?? [],
    photoName: f.photo_url ?? null,
    editorialSummary: f.description ?? null,
    openNow: null,
    gemScore: 0,
    hidden_gem: false,
    isFeatured: true,
    lat: f.lat ?? lat,
    lng: f.lng ?? lng,
  }));

  const INJECT_POSITIONS = [3, 9, 17];
  const final: PlaceResult[] = [...results];
  featuredPlaces.forEach((fp, i) => {
    const pos = INJECT_POSITIONS[i];
    if (pos !== undefined && pos <= final.length) {
      final.splice(pos, 0, fp);
    } else {
      final.push(fp);
    }
  });

  return NextResponse.json({ places: final });
}
