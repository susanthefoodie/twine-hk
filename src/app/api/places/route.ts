export const maxDuration = 30;
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, radiusMetres = 1500 } = body;

    console.log('PLACES: calling Google with', lat, lng);

    const googleRes = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.formattedAddress,places.regularOpeningHours,places.primaryTypeDisplayName,places.editorialSummary',
        },
        body: JSON.stringify({
          includedTypes: ['restaurant', 'cafe', 'bar', 'bakery'],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMetres,
            },
          },
        }),
      }
    );

    console.log('GOOGLE STATUS:', googleRes.status);
    const data = await googleRes.json();
    console.log('GOOGLE PLACES COUNT:', data.places?.length ?? 0);

    if (!googleRes.ok) {
      console.error('GOOGLE ERROR:', JSON.stringify(data));
      return NextResponse.json({ error: 'Google Places API error', detail: data }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places = (data.places ?? []).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text ?? 'Unknown',
      rating: p.rating ?? 0,
      reviewCount: p.userRatingCount ?? 0,
      priceLevel: p.priceLevel ?? null,
      priceLabel: ['$', '$', '$$', '$$$', '$$$$'][p.priceLevel - 1] ?? '$',
      address: p.formattedAddress ?? '',
      photoName: p.photos?.[0]?.name ?? null,
      openNow: p.regularOpeningHours?.openNow ?? null,
      cuisineTypes: p.primaryTypeDisplayName?.text ? [p.primaryTypeDisplayName.text] : [],
      editorialSummary: p.editorialSummary?.text ?? null,
      hidden_gem: (p.userRatingCount ?? 999) < 400 && (p.rating ?? 0) >= 4.0,
      gemScore: 50,
      lat,
      lng,
    }));

    return NextResponse.json({ places });

  } catch (err: unknown) {
    const error = err as Error | null;
    console.error('PLACES ROUTE CRASH:', error?.message, error?.stack);
    return NextResponse.json({ error: error?.message ?? 'Unknown error' }, { status: 500 });
  }
}
