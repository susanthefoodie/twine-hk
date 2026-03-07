import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log('PLACES START');
  console.log('KEY EXISTS:', !!process.env.GOOGLE_PLACES_API_KEY);
  console.log('KEY LENGTH:', process.env.GOOGLE_PLACES_API_KEY?.length);
  try {
    const { lat, lng, radiusMetres = 1500 } = await req.json();
    console.log('PLACES: calling Google', lat, lng);
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY || '',
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.formattedAddress,places.regularOpeningHours,places.primaryTypeDisplayName',
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
    });
    console.log('GOOGLE STATUS:', res.status);
    const data = await res.json();
    console.log('GOOGLE COUNT:', data.places?.length ?? 0);
    const places = (data.places ?? []).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text ?? 'Unknown',
      rating: p.rating ?? 0,
      reviewCount: p.userRatingCount ?? 0,
      priceLevel: p.priceLevel ?? null,
      priceLabel: ['$', '$', '$$', '$$$'][(p.priceLevel ?? 2) - 1] ?? '$',
      address: p.formattedAddress ?? '',
      photoName: p.photos?.[0]?.name ?? null,
      openNow: p.regularOpeningHours?.openNow ?? null,
      cuisineTypes: p.primaryTypeDisplayName?.text ? [p.primaryTypeDisplayName.text] : [],
      hidden_gem: (p.userRatingCount ?? 999) < 400,
      gemScore: 50,
      lat,
      lng,
    }));
    return NextResponse.json({ places });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('PLACES ERROR:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
