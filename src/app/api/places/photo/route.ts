import { NextRequest, NextResponse } from 'next/server';

// Proxy Google Places photo requests so the API key never reaches the browser.
// Usage: /api/places/photo?name=places%2FChIJ...%2Fphotos%2FAXQ...&maxWidthPx=800
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name');   // e.g. "places/xxx/photos/yyy"
  const maxWidthPx = searchParams.get('maxWidthPx') ?? '800';

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === 'replace_me') {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503 });
  }

  const googleUrl =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxWidthPx=${maxWidthPx}&key=${apiKey}&skipHttpRedirect=true`;

  const googleRes = await fetch(googleUrl);
  if (!googleRes.ok) {
    return NextResponse.json(
      { error: 'Google photo fetch failed' },
      { status: googleRes.status }
    );
  }

  const json = (await googleRes.json()) as { photoUri?: string };
  if (!json.photoUri) {
    return NextResponse.json({ error: 'No photo URI returned' }, { status: 404 });
  }

  // Redirect to the signed CDN URL (short-lived, no API key in client)
  return NextResponse.redirect(json.photoUri);
}
