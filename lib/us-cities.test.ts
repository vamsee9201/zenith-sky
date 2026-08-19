import { FEATURED_CITIES, FEATURED_CITY_IDS, US_CITIES } from "@/lib/us-cities";

describe("U.S. city picker data", () => {
  it("contains the 20 Census-ranked cities with unique identifiers", () => {
    expect(US_CITIES).toHaveLength(20);
    expect(new Set(US_CITIES.map((city) => city.id)).size).toBe(20);
    expect(US_CITIES.map((city) => city.censusRank)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("keeps every city center within coordinate bounds", () => {
    for (const city of US_CITIES) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
    }
  });

  it("uses the requested featured-city order", () => {
    expect(FEATURED_CITY_IDS).toEqual([
      "san-francisco-ca",
      "new-york-ny",
      "seattle-wa",
      "dallas-tx",
    ]);
    expect(FEATURED_CITIES.map((city) => city.id)).toEqual(FEATURED_CITY_IDS);
  });
});
