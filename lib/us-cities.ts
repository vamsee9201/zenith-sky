export interface UsCity {
  id: string;
  name: string;
  state: string;
  censusRank: number;
  latitude: number;
  longitude: number;
}

export const US_CITIES: readonly UsCity[] = [
  { id: "new-york-ny", name: "New York", state: "NY", censusRank: 1, latitude: 40.7128, longitude: -74.006 },
  { id: "los-angeles-ca", name: "Los Angeles", state: "CA", censusRank: 2, latitude: 34.0522, longitude: -118.2437 },
  { id: "chicago-il", name: "Chicago", state: "IL", censusRank: 3, latitude: 41.8781, longitude: -87.6298 },
  { id: "houston-tx", name: "Houston", state: "TX", censusRank: 4, latitude: 29.7604, longitude: -95.3698 },
  { id: "phoenix-az", name: "Phoenix", state: "AZ", censusRank: 5, latitude: 33.4484, longitude: -112.074 },
  { id: "philadelphia-pa", name: "Philadelphia", state: "PA", censusRank: 6, latitude: 39.9526, longitude: -75.1652 },
  { id: "san-antonio-tx", name: "San Antonio", state: "TX", censusRank: 7, latitude: 29.4241, longitude: -98.4936 },
  { id: "san-diego-ca", name: "San Diego", state: "CA", censusRank: 8, latitude: 32.7157, longitude: -117.1611 },
  { id: "dallas-tx", name: "Dallas", state: "TX", censusRank: 9, latitude: 32.7767, longitude: -96.797 },
  { id: "fort-worth-tx", name: "Fort Worth", state: "TX", censusRank: 10, latitude: 32.7555, longitude: -97.3308 },
  { id: "jacksonville-fl", name: "Jacksonville", state: "FL", censusRank: 11, latitude: 30.3322, longitude: -81.6557 },
  { id: "austin-tx", name: "Austin", state: "TX", censusRank: 12, latitude: 30.2672, longitude: -97.7431 },
  { id: "san-jose-ca", name: "San Jose", state: "CA", censusRank: 13, latitude: 37.3382, longitude: -121.8863 },
  { id: "charlotte-nc", name: "Charlotte", state: "NC", censusRank: 14, latitude: 35.2271, longitude: -80.8431 },
  { id: "columbus-oh", name: "Columbus", state: "OH", censusRank: 15, latitude: 39.9612, longitude: -82.9988 },
  { id: "indianapolis-in", name: "Indianapolis", state: "IN", censusRank: 16, latitude: 39.7684, longitude: -86.1581 },
  { id: "san-francisco-ca", name: "San Francisco", state: "CA", censusRank: 17, latitude: 37.7749, longitude: -122.4194 },
  { id: "seattle-wa", name: "Seattle", state: "WA", censusRank: 18, latitude: 47.6062, longitude: -122.3321 },
  { id: "denver-co", name: "Denver", state: "CO", censusRank: 19, latitude: 39.7392, longitude: -104.9903 },
  { id: "nashville-tn", name: "Nashville", state: "TN", censusRank: 20, latitude: 36.1627, longitude: -86.7816 },
];

export const FEATURED_CITY_IDS = [
  "san-francisco-ca",
  "new-york-ny",
  "seattle-wa",
  "dallas-tx",
] as const;

const featuredCityIds = new Set<string>(FEATURED_CITY_IDS);

export const FEATURED_CITIES = FEATURED_CITY_IDS.map((id) =>
  US_CITIES.find((city) => city.id === id),
).filter((city): city is UsCity => city !== undefined);

export const OTHER_US_CITIES = US_CITIES.filter((city) => !featuredCityIds.has(city.id));

export function findUsCity(id: string | undefined): UsCity | undefined {
  return id ? US_CITIES.find((city) => city.id === id) : undefined;
}

export function formatCityName(city: UsCity): string {
  return `${city.name}, ${city.state}`;
}
