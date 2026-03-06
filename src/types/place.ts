export interface PlaceResult {
  id: string;           // Google Place ID (places/ChIJ...)
  name: string;
  chineseName?: string | null;   // zh-TW display name (only if differs from English)
  address: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;   // 0–4
  priceLabel: string;   // '$' | '$$' | '$$$' | '$$$$'
  cuisineTypes: string[];
  photoName: string | null; // Google Photos resource name for /api/places/photo proxy
  editorialSummary: string | null;
  openNow: boolean | null;
  gemScore: number;
  hidden_gem: boolean;
  isFeatured?: boolean;
  lat: number;
  lng: number;
}
