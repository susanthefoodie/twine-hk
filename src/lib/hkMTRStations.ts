// HK MTR stations with approximate centre-platform coordinates

export interface MTRStation {
  name: string;       // English name
  nameChi: string;    // Chinese name
  line: string;       // Line abbreviation
  lat: number;
  lng: number;
}

export const HK_MTR_STATIONS: MTRStation[] = [
  { name: 'Central',           nameChi: '中環',   line: 'TWL/ISL', lat: 22.2820, lng: 114.1575 },
  { name: 'Admiralty',         nameChi: '金鐘',   line: 'ISL/TWL', lat: 22.2790, lng: 114.1650 },
  { name: 'Wan Chai',          nameChi: '灣仔',   line: 'ISL',     lat: 22.2773, lng: 114.1731 },
  { name: 'Causeway Bay',      nameChi: '銅鑼灣', line: 'ISL',     lat: 22.2802, lng: 114.1840 },
  { name: 'Mong Kok',          nameChi: '旺角',   line: 'KWL/TWL', lat: 22.3193, lng: 114.1693 },
  { name: 'Tsim Sha Tsui',     nameChi: '尖沙咀', line: 'TWL',     lat: 22.2975, lng: 114.1722 },
  { name: 'Jordan',            nameChi: '佐敦',   line: 'TWL',     lat: 22.3050, lng: 114.1717 },
  { name: 'Yau Ma Tei',        nameChi: '油麻地', line: 'TWL',     lat: 22.3126, lng: 114.1703 },
  { name: 'Sham Shui Po',      nameChi: '深水埗', line: 'TWL',     lat: 22.3301, lng: 114.1620 },
  { name: 'Kowloon Tong',      nameChi: '九龍塘', line: 'KCR/TWL', lat: 22.3369, lng: 114.1782 },
  { name: 'Wong Tai Sin',      nameChi: '黃大仙', line: 'KWL',     lat: 22.3416, lng: 114.1945 },
  { name: 'Diamond Hill',      nameChi: '鑽石山', line: 'KWL',     lat: 22.3400, lng: 114.2012 },
  { name: 'Kwun Tong',         nameChi: '觀塘',   line: 'KWL',     lat: 22.3120, lng: 114.2261 },
  { name: 'Tuen Mun',          nameChi: '屯門',   line: 'WRL',     lat: 22.3941, lng: 113.9738 },
  { name: 'Sha Tin',           nameChi: '沙田',   line: 'ERL',     lat: 22.3817, lng: 114.1876 },
  { name: 'Tai Po Market',     nameChi: '大埔墟', line: 'ERL',     lat: 22.4446, lng: 114.1698 },
  { name: 'Tung Chung',        nameChi: '東涌',   line: 'TCL',     lat: 22.2889, lng: 113.9428 },
  { name: 'Kennedy Town',      nameChi: '堅尼地城', line: 'ISL',   lat: 22.2812, lng: 114.1280 },
  { name: 'North Point',       nameChi: '北角',   line: 'ISL',     lat: 22.2910, lng: 114.1992 },
  { name: 'Quarry Bay',        nameChi: '鰂魚涌', line: 'ISL',     lat: 22.2873, lng: 114.2092 },
];

// Haversine distance in metres between two lat/lng points
export function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find the nearest MTR station to a given coordinate
export function nearestMTRStation(lat: number, lng: number): MTRStation {
  let nearest = HK_MTR_STATIONS[0];
  let minDist = Infinity;
  for (const station of HK_MTR_STATIONS) {
    const d = haversineMetres(lat, lng, station.lat, station.lng);
    if (d < minDist) { minDist = d; nearest = station; }
  }
  return nearest;
}
