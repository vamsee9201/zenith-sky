import { azimuthToCompass, lookAnglesForObject, objectsOverhead, validateObserver } from "@/lib/orbit";
import { catalogObjectFixture } from "@/test/fixtures";

describe("orbital look angles", () => {
  const epoch = new Date("2026-08-18T11:19:41.098944Z");

  it("matches the fixed OMM reference look angles for Los Angeles", () => {
    const look = lookAnglesForObject(
      catalogObjectFixture,
      { latitude: 34.0522, longitude: -118.2437 },
      epoch,
    );

    expect(look).not.toBeNull();
    expect(look!.elevationDegrees).toBeCloseTo(-8.19897, 3);
    expect(look!.azimuthDegrees).toBeCloseTo(193.24807, 3);
    expect(look!.rangeKm).toBeCloseTo(4044.289, 2);
  });

  it("returns overhead objects highest first", () => {
    const result = objectsOverhead(
      [catalogObjectFixture],
      { latitude: -0.000027, longitude: -125.716124 },
      epoch,
    );
    expect(result).toHaveLength(1);
    expect(result[0].elevationDegrees).toBeGreaterThan(89.9);
  });

  it.each([
    [0, "N"], [44, "NE"], [90, "E"], [181, "S"], [270, "W"], [359, "N"], [-45, "NW"],
  ])("maps %s degrees to %s", (degrees, direction) => {
    expect(azimuthToCompass(degrees as number)).toBe(direction);
  });

  it("rejects invalid observer coordinates", () => {
    expect(() => validateObserver({ latitude: 91, longitude: 0 })).toThrow(/Latitude/);
    expect(() => validateObserver({ latitude: 0, longitude: -181 })).toThrow(/Longitude/);
  });
});

