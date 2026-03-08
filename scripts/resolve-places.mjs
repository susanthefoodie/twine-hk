import 'dotenv/config'

const MAPS_URLS = [
  'https://maps.app.goo.gl/ywfCYd72SKdHYiVg7',
  'https://maps.app.goo.gl/jezTFeKPJT7Z3E8GA',
  'https://maps.app.goo.gl/7Xy1VDTziV5EtktYA',
  'https://maps.app.goo.gl/uXc81Zhu97WKo7Fp6',
  'https://maps.app.goo.gl/QAcYabEJyztNELzB6',
  'https://maps.app.goo.gl/eBeNbwsneWHjdiuQ6',
  'https://maps.app.goo.gl/d2yuWUdhu9m9Vttr5',
  'https://maps.app.goo.gl/k2ZwFKAhYREwZUE7A',
  'https://maps.app.goo.gl/4N2tKd9TpekVNYKg6',
  'https://maps.app.goo.gl/MQdo2z3291HZKVTA7',
  'https://maps.app.goo.gl/DiLHiPNqHgsGz1UA9',
  'https://maps.app.goo.gl/hAvDqcaKQWuxn58t8',
  'https://maps.app.goo.gl/uxn7vcmtJRpp1QU47',
  'https://maps.app.goo.gl/VuuBV2npaywrYneX7',
  'https://maps.app.goo.gl/F8zCMr6fth9QJDyg6',
]

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not set in .env.local')
  process.exit(1)
}

// Follow a short URL redirect and return the final URL
async function resolveRedirect(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' })
    return res.url
  } catch (e) {
    console.error('Redirect failed for', url, e.message)
    return null
  }
}

// Extract a usable place name from the expanded Google Maps URL
function extractPlaceName(expandedUrl) {
  try {
    const decoded = decodeURIComponent(expandedUrl)
    // Pattern 1: /place/Name+Of+Place/@lat,lng
    const placeMatch = decoded.match(/\/place\/([^/@]+)\/@/)
    if (placeMatch) {
      return placeMatch[1].replace(/\+/g, ' ').replace(/_/g, ' ').trim()
    }
    // Pattern 2: /maps/place/Name/@...
    const mapsMatch = decoded.match(/maps\/place\/([^/@?]+)/)
    if (mapsMatch) {
      return mapsMatch[1].replace(/\+/g, ' ').replace(/_/g, ' ').trim()
    }
    // Pattern 3: ?q=Name+of+place
    const qMatch = decoded.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      return qMatch[1].replace(/\+/g, ' ').trim()
    }
    return null
  } catch {
    return null
  }
}

// Search Google Places Text Search API by name
async function searchPlace(query) {
  try {
    const res = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.photos,places.priceLevel',
        },
        body: JSON.stringify({ textQuery: query }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      console.error('Places API error:', JSON.stringify(data))
      return null
    }
    return data.places?.[0] ?? null
  } catch (e) {
    console.error('searchPlace error:', e.message)
    return null
  }
}

async function main() {
  console.log(`\nResolving ${MAPS_URLS.length} Google Maps URLs...\n`)
  const results = []

  for (let i = 0; i < MAPS_URLS.length; i++) {
    const shortUrl = MAPS_URLS[i]
    process.stdout.write(`[${i + 1}/${MAPS_URLS.length}] ${shortUrl} ... `)

    // Step 1: Resolve redirect
    const expandedUrl = await resolveRedirect(shortUrl)
    if (!expandedUrl) {
      console.log('FAILED (redirect)')
      results.push({ shortUrl, error: 'redirect failed' })
      continue
    }

    // Step 2: Extract place name
    const placeName = extractPlaceName(expandedUrl)
    if (!placeName) {
      console.log('FAILED (name extraction)')
      console.error('  Expanded URL was:', expandedUrl)
      results.push({ shortUrl, expandedUrl, error: 'name extraction failed' })
      continue
    }
    process.stdout.write(`"${placeName}" ... `)

    // Step 3: Look up in Places API
    const place = await searchPlace(`${placeName} Hong Kong`)
    if (!place) {
      console.log('FAILED (places API)')
      results.push({ shortUrl, placeName, error: 'places API returned no results' })
      continue
    }

    const result = {
      id: place.id,
      name: place.displayName?.text ?? placeName,
      address: place.formattedAddress ?? '',
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      rating: place.rating ?? null,
      reviews: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ?? null,
      photoName: place.photos?.[0]?.name ?? null,
    }
    results.push(result)
    console.log('OK')
  }

  console.log('\n\n=== RESULTS ===\n')
  console.log(JSON.stringify(results, null, 2))

  console.log('\n\n=== TYPESCRIPT ARRAY (copy into featured-places.ts) ===\n')
  const successful = results.filter(r => r.id)
  const tsEntries = successful.map(r => `  {
    id: '${r.id}',
    name: '${r.name.replace(/'/g, "\\'")}',
    address: '${r.address.replace(/'/g, "\\'")}',
    lat: ${r.lat},
    lng: ${r.lng},
    rating: ${r.rating},
    reviewCount: ${r.reviews},
    priceLevel: ${r.priceLevel ? `'${r.priceLevel}'` : 'null'},
    priceLabel: '${r.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '$' : r.priceLevel === 'PRICE_LEVEL_MODERATE' ? '$$' : r.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$' : '$$'}',
    photoName: ${r.photoName ? `'${r.photoName}'` : 'null'},
    hidden_gem: true,
    isFeatured: true,
    gemScore: 999,
    chineseName: null,
    openNow: null,
    cuisineTypes: [],
    editorialSummary: null,
    districtName: '',
  }`).join(',\n')

  console.log(`export const FEATURED_PLACES = [\n${tsEntries}\n]`)
}

main()
