import { NextRequest, NextResponse } from 'next/server';

// ── Google Places Detail types ────────────────────────────────────────────────

interface GooglePlaceDetail {
  id: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name: string }[];
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: {
      open:  { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }[];
    weekdayDescriptions?: string[];
  };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude: number; longitude: number };
  editorialSummary?: { text: string };
  primaryTypeDisplayName?: { text: string };
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const PRICE_LABELS = ['$', '$', '$$', '$$$', '$$$$'];

const FIELDS = [
  'id', 'displayName', 'rating', 'userRatingCount', 'priceLevel',
  'photos', 'regularOpeningHours', 'formattedAddress',
  'nationalPhoneNumber', 'websiteUri', 'location',
  'editorialSummary', 'primaryTypeDisplayName',
].join(',');

// GET /api/places/detail?id=ChIJ...
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === 'replace_me') {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503 });
  }

  const baseUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;
  const headers = { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS };

  // Fetch English detail + Chinese displayName in parallel
  const [enRes, zhRes] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}?languageCode=zh-TW`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'displayName' },
    }),
  ]);

  if (!enRes.ok) {
    const msg = await enRes.text();
    return NextResponse.json({ error: `Google API: ${msg}` }, { status: enRes.status });
  }

  const place = (await enRes.json()) as GooglePlaceDetail;
  const zhBody = zhRes.ok ? ((await zhRes.json()) as { displayName?: { text: string } }) : null;

  const enName = place.displayName?.text ?? '';
  const zhName = zhBody?.displayName?.text ?? null;
  // Only expose Chinese name if it actually differs from English
  const chineseName = zhName && zhName !== enName ? zhName : null;

  const priceNum = PRICE_MAP[place.priceLevel ?? ''] ?? 0;

  return NextResponse.json({
    id: place.id,
    name: enName,
    chineseName,
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    priceLevel: priceNum,
    priceLabel: PRICE_LABELS[priceNum] ?? '$',
    photos: (place.photos ?? []).slice(0, 8).map((p) => p.name),
    openNow: place.regularOpeningHours?.openNow ?? null,
    weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions ?? [],
    address: place.formattedAddress ?? '',
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    editorialSummary: place.editorialSummary?.text ?? null,
    primaryType: place.primaryTypeDisplayName?.text ?? null,
  });
}
