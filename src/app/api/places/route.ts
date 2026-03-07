import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { PlaceResult } from '@/types/place';

// ── Route config ──────────────────────────────────────────────────────────────

export const maxDuration = 30;
export const runtime = 'nodejs';

// ── Constants ─────────────────────────────────────────────────────────────────

// All food-only types — used as the base includedTypes when no cuisines selected
const ALL_FOOD_TYPES = [
  'restaurant', 'cafe', 'bar', 'food', 'bakery', 'meal_takeaway',
  'meal_delivery', 'chinese_restaurant', 'japanese_restaurant',
  'korean_restaurant', 'thai_restaurant', 'vietnamese_restaurant',
  'indian_restaurant', 'french_restaurant', 'italian_restaurant',
  'mexican_restaurant', 'american_restaurant', 'seafood_restaurant',
  'steak_house', 'sushi_restaurant', 'ramen_restaurant',
  'noodle_restaurant', 'dim_sum_restaurant', 'hot_pot_restaurant',
  'izakaya_restaurant', 'wine_bar', 'cocktail_bar', 'tea_house',
  'dessert_shop', 'ice_cream_shop', 'bubble_tea_store', 'fast_food_restaurant',
];

// Hard-blocked non-food place types
const EXCLUDED_TYPES = [
  'transit_station', 'subway_station', 'train_station', 'bus_station',
  'airport', 'lodging', 'hotel', 'shopping_mall', 'supermarket',
  'convenience_store', 'gas_station', 'bank', 'atm', 'hospital',
  'pharmacy', 'school', 'university', 'park', 'museum', 'gym',
  'spa', 'beauty_salon', 'car_dealer', 'real_estate_agency',
];

// Cuisine → specific Google types
const CUISINE_TYPE_MAP: Record<string, string[]> = {
  'Cantonese':   ['chinese_restaurant', 'dim_sum_restaurant', 'hot_pot_restaurant'],
  'Hot Pot':     ['hot_pot_restaurant', 'chinese_restaurant'],
  'Japanese':    ['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant', 'izakaya_restaurant'],
  'Korean':      ['korean_restaurant'],
  'Western':     ['american_restaurant', 'french_restaurant', 'italian_restaurant', 'steak_house'],
  'SE Asian':    ['thai_restaurant', 'vietnamese_restaurant'],
  'Indian':      ['indian_restaurant'],
  'Café/Brunch': ['cafe', 'bakery'],
  'Bar Bites':   ['bar', 'wine_bar', 'cocktail_bar'],
  'Dessert':     ['dessert_shop', 'ice_cream_shop', 'bubble_tea_store', 'tea_house'],
  'Fast Casual': ['fast_food_restaurant', 'meal_takeaway'],
};

// Chain restaurant blocklist — any name containing these strings is removed
const CHAIN_BLOCKLIST = [
  'McDonald', 'KFC', 'Burger King', 'Starbucks', 'Pizza Hut', 'Subway',
  'Domino', 'Cafe de Coral', '大家樂', 'Fairwood', '大快活', 'Maxim', '美心',
  'Yoshinoya', '吉野家', 'Pacific Coffee', 'Pret a Manger', 'Oliver',
  'Shake Shack', 'Five Guys', 'Greggs', 'Costa', 'Tim Hortons',
  'Jollibee', 'Popeyes', 'Wendy', 'Hardee', 'Crystal Jade', '翠園',
  'Peking Garden', 'Super Super', 'Tsui Wah', '翠華',
  'Tai Hing', '太興', 'Spaghetti House', 'Genki Sushi', '元氣壽司',
  'Ichiran', 'Ippudo', 'Din Tai Fung', '鼎泰豐',
];

// HK district names for address parsing
const HK_DISTRICTS = [
  'Central', 'Sheung Wan', 'Wan Chai', 'Causeway Bay', 'Kennedy Town',
  'Sai Ying Pun', 'Admiralty', 'Happy Valley', 'North Point', 'Quarry Bay',
  'Tai Koo', 'Sai Kung', 'TST', 'Tsim Sha Tsui', 'Jordan', 'Mong Kok',
  'Yau Ma Tei', 'Sham Shui Po', 'Aberdeen', 'Ap Lei Chau', 'Stanley',
  'Repulse Bay', 'Lantau', 'Tung Chung',
];

// Price level string → numeric (0–4)
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE:           0,
  PRICE_LEVEL_INEXPENSIVE:    1,
  PRICE_LEVEL_MODERATE:       2,
  PRICE_LEVEL_EXPENSIVE:      3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const PRICE_LABELS: Record<number, string> = {
  0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$',
};

// ── Google Places types ───────────────────────────────────────────────────────

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  primaryTypeDisplayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  photos?: { name: string }[];
  editorialSummary?: { text: string };
  currentOpeningHours?: { openNow: boolean };
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
}

interface NearbySearchResponse {
  places?: GooglePlace[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normPrice(raw: string | undefined): number {
  return PRICE_LEVEL_MAP[raw ?? ''] ?? -1; // -1 = unknown
}

function extractDistrict(address: string): string | null {
  for (const d of HK_DISTRICTS) {
    if (address.includes(d)) return d;
  }
  // Fallback: last meaningful segment before "Hong Kong"
  const withoutHK = address.replace(/,?\s*Hong Kong\s*$/i, '');
  const parts = withoutHK.split(',').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_BLOCKLIST.some((c) => lower.includes(c.toLowerCase()));
}

// ── Gem scoring ───────────────────────────────────────────────────────────────

function calcGemScore(place: GooglePlace): number {
  let score = 0;
  const count   = place.userRatingCount ?? 0;
  const rating  = place.rating ?? 0;
  const name    = place.displayName?.text ?? '';
  const photos  = place.photos?.length ?? 999;

  // Review count signals
  if (count >= 50  && count <= 150) score += 35;
  else if (count >= 151 && count <= 400) score += 25;
  else if (count >= 401 && count <= 800) score += 10;
  if (count > 1200) score -= 50;
  else if (count > 800) score -= 20;

  // Rating signals
  if (rating >= 4.5)              score += 25;
  else if (rating >= 4.2)         score += 15;
  else if (rating >= 4.0)         score += 5;
  if (rating < 3.8)               score -= 30;

  // Editorial summary — Google editors highlighted it
  if (place.editorialSummary?.text) score += 20;

  // Specific primary type (not generic "Restaurant")
  const primaryType = place.primaryTypeDisplayName?.text ?? '';
  if (primaryType && primaryType.toLowerCase() !== 'restaurant') score += 15;

  // Hidden gem name signals
  if (/小|隱|secret|hidden|private|omakase|speakeasy/i.test(name)) score += 20;

  // Independent business signal — has a website
  const website = place.websiteUri ?? '';
  if (website) {
    const knownChainDomains = ['mcdonalds', 'starbucks', 'kfc', 'pizzahut', 'subway'];
    if (!knownChainDomains.some((d) => website.includes(d))) score += 10;
  }

  // Under the radar — few photos means not heavily marketed
  if (photos < 10) score += 10;

  // Chain blocklist — instant disqualification
  if (isChain(name)) score -= 999;

  return score;
}

// ── POST /api/places ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
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

    const {
      lat, lng, radiusMetres,
      cuisines = [],
      budgetLevels = [],
      openNow = false,
      alreadySwiped = [],
    } = body;

    console.log('[api/places] request:', { lat, lng, radiusMetres, cuisines, budgetLevels, openNow });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('[api/places] API key present:', !!apiKey, 'length:', apiKey?.length);
    if (!apiKey || apiKey === 'replace_me') {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 503 });
    }

    // MTR mode: radiusMetres=99999 → use 800m around the station coords
    const searchRadius = radiusMetres === 99999 ? 800 : Math.min(radiusMetres, 50000);

    // Build includedTypes: cuisine-specific types if selected, otherwise full food list
    const includedTypes: string[] = cuisines.length > 0
      ? Array.from(new Set(cuisines.flatMap((c) => CUISINE_TYPE_MAP[c] ?? ['restaurant'])))
      : ALL_FOOD_TYPES;

    const searchPayload: Record<string, unknown> = {
      includedTypes,
      excludedTypes: EXCLUDED_TYPES,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: searchRadius,
        },
      },
      maxResultCount: 20,
    };

    console.log('[api/places] Google request body:', JSON.stringify(searchPayload));

    const FIELD_MASK = [
      'places.id', 'places.displayName', 'places.primaryTypeDisplayName',
      'places.formattedAddress', 'places.rating', 'places.userRatingCount',
      'places.priceLevel', 'places.types', 'places.photos',
      'places.editorialSummary', 'places.currentOpeningHours',
      'places.location', 'places.websiteUri',
    ].join(',');

    const baseHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    };

    // 8-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let enRes: Response;
    try {
      enRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { ...baseHeaders, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify(searchPayload),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      console.error('[api/places] fetch error:', isTimeout ? 'timed out after 8s' : fetchErr);
      return NextResponse.json(
        { error: isTimeout ? 'Google Places request timed out' : 'Failed to reach Google Places API' },
        { status: 502 }
      );
    }
    clearTimeout(timeoutId);

    const enBody = await enRes.text();
    console.log('[api/places] Google response status:', enRes.status, 'body preview:', enBody.slice(0, 300));

    if (!enRes.ok) {
      return NextResponse.json(
        { error: `Google Places API returned ${enRes.status}: ${enBody}` },
        { status: 502 }
      );
    }

    const enData = JSON.parse(enBody) as NearbySearchResponse;
    const raw = enData.places ?? [];
    console.log('[api/places] raw places returned:', raw.length);

    // ── zh-TW parallel fetch (best-effort) ──────────────────────────────────

    let zhRes: Response | null = null;
    try {
      zhRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'X-Goog-FieldMask': 'places.id,places.displayName',
          'Accept-Language': 'zh-TW',
        },
        body: JSON.stringify({ ...searchPayload, languageCode: 'zh-TW' }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      console.warn('[api/places] zh-TW fetch failed, skipping Chinese names');
    }

    const zhNameMap = new Map<string, string>();
    if (zhRes?.ok) {
      try {
        const zhData = (await zhRes.json()) as {
          places?: { id: string; displayName?: { text: string } }[];
        };
        for (const p of zhData.places ?? []) {
          if (p.id && p.displayName?.text) zhNameMap.set(p.id, p.displayName.text);
        }
      } catch { /* non-fatal */ }
    }

    // ── Score every place ────────────────────────────────────────────────────

    const scored = raw.map((p) => ({ place: p, score: calcGemScore(p) }));

    // ── Filter ───────────────────────────────────────────────────────────────

    const filtered = scored.filter(({ place, score }) => {
      const count  = place.userRatingCount ?? 0;
      const rating = place.rating ?? 0;

      if (score < 0)      return false; // chains (-999) and low-rated (<0)
      if (rating < 3.8)   return false;
      if (count < 30)     return false; // not enough data
      if (count > 1500)   return false; // too famous

      // Budget filter: skip only if priceLevel is known AND doesn't match
      if (budgetLevels.length > 0) {
        const priceNum = normPrice(place.priceLevel);
        if (priceNum !== -1 && !budgetLevels.includes(priceNum)) return false;
      }

      // Open now filter
      if (openNow && place.currentOpeningHours?.openNow !== true) return false;

      // Already swiped deduplication
      if (alreadySwiped.includes(place.id)) return false;

      return true;
    });

    // ── Sort by gemScore descending, take top 20 ─────────────────────────────

    filtered.sort((a, b) => b.score - a.score);
    const top20 = filtered.slice(0, 20);
    console.log('[api/places] places after filtering and scoring:', top20.length);

    // ── Transform to PlaceResult ─────────────────────────────────────────────

    const results: PlaceResult[] = top20.map(({ place, score }) => {
      const priceNum    = normPrice(place.priceLevel);
      const priceLabel  = priceNum === -1 ? '$' : (PRICE_LABELS[priceNum] ?? '$');
      const enName      = place.displayName?.text ?? 'Unknown';
      const zhName      = zhNameMap.get(place.id) ?? null;
      const chineseName = zhName && zhName !== enName ? zhName : null;
      const address     = place.formattedAddress ?? '';

      return {
        id:               place.id,
        name:             enName,
        chineseName,
        address,
        districtName:     extractDistrict(address),
        rating:           place.rating ?? 0,
        reviewCount:      place.userRatingCount ?? 0,
        priceLevel:       priceNum === -1 ? 0 : priceNum,
        priceLabel,
        cuisineTypes:     place.types ?? [],
        photoName:        place.photos?.[0]?.name ?? null,
        editorialSummary: place.editorialSummary?.text ?? null,
        openNow:          place.currentOpeningHours?.openNow ?? null,
        gemScore:         score,
        hidden_gem:       score >= 40,
        lat:              place.location?.latitude ?? lat,
        lng:              place.location?.longitude ?? lng,
      };
    });

    // ── Inject featured restaurants ──────────────────────────────────────────

    const admin = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: featuredRows } = await admin
      .from('featured_restaurants')
      .select('*')
      .eq('is_active', true)
      .gte('plan_end', today)
      .limit(3);

    const final: PlaceResult[] = [...results];

    if (featuredRows && featuredRows.length > 0) {
      const INJECT_POSITIONS = [4, 11, 18];

      for (let i = 0; i < featuredRows.length; i++) {
        const f = featuredRows[i];

        // Fetch live data from Google Places Details for the featured place
        let featuredPlace: PlaceResult | null = null;
        try {
          const detailRes = await fetch(
            `https://places.googleapis.com/v1/places/${f.place_id}`,
            {
              headers: {
                ...baseHeaders,
                'X-Goog-FieldMask': FIELD_MASK,
              },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (detailRes.ok) {
            const detail = (await detailRes.json()) as GooglePlace;
            const priceNum   = normPrice(detail.priceLevel);
            const address    = detail.formattedAddress ?? f.address ?? '';
            featuredPlace = {
              id:               detail.id ?? f.place_id,
              name:             detail.displayName?.text ?? f.name,
              chineseName:      null,
              address,
              districtName:     extractDistrict(address),
              rating:           detail.rating ?? f.rating ?? 0,
              reviewCount:      detail.userRatingCount ?? 0,
              priceLevel:       priceNum === -1 ? 0 : priceNum,
              priceLabel:       priceNum === -1 ? '$' : (PRICE_LABELS[priceNum] ?? '$'),
              cuisineTypes:     detail.types ?? [],
              photoName:        detail.photos?.[0]?.name ?? null,
              editorialSummary: detail.editorialSummary?.text ?? null,
              openNow:          detail.currentOpeningHours?.openNow ?? null,
              gemScore:         0,
              hidden_gem:       false,
              isFeatured:       true,
              lat:              detail.location?.latitude ?? lat,
              lng:              detail.location?.longitude ?? lng,
            };
          }
        } catch {
          console.warn('[api/places] featured place detail fetch failed for', f.place_id);
        }

        // Fall back to stored data if live fetch failed
        if (!featuredPlace) {
          featuredPlace = {
            id:               `featured_${f.id}`,
            name:             f.name,
            chineseName:      null,
            address:          f.address ?? '',
            districtName:     f.address ? extractDistrict(f.address) : null,
            rating:           f.rating ?? 0,
            reviewCount:      f.review_count ?? 0,
            priceLevel:       f.price_level ?? 0,
            priceLabel:       PRICE_LABELS[f.price_level ?? 0] ?? '$',
            cuisineTypes:     f.cuisine_types ?? [],
            photoName:        f.photo_url ?? null,
            editorialSummary: f.description ?? null,
            openNow:          null,
            gemScore:         0,
            hidden_gem:       false,
            isFeatured:       true,
            lat:              f.lat ?? lat,
            lng:              f.lng ?? lng,
          };
        }

        const pos = INJECT_POSITIONS[i];
        if (pos !== undefined && pos <= final.length) {
          final.splice(pos, 0, featuredPlace);
        } else {
          final.push(featuredPlace);
        }
      }
    }

    console.log('[api/places] returning', final.length, 'places total');
    return NextResponse.json({ places: final });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[api/places] unhandled error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
