import {
  EARTH_SHADOW_RADIUS_KM,
  groupPassSamples,
  isSatelliteSunlit,
  observerSolarAltitude,
  sunVectorEquatorOfDate,
} from "@/lib/visibility";

describe("visible-pass geometry", () => {
  it("distinguishes sunward, shadowed, and cylindrical boundary positions", () => {
    const sun = { x: 1, y: 0, z: 0 };
    expect(isSatelliteSunlit({ x: 7000, y: 0, z: 0 }, sun)).toBe(true);
    expect(isSatelliteSunlit({ x: -7000, y: 0, z: 0 }, sun)).toBe(false);
    expect(isSatelliteSunlit({ x: -7000, y: EARTH_SHADOW_RADIUS_KM, z: 0 }, sun)).toBe(true);
  });

  it("converts the geocentric Sun vector to a finite equator-of-date direction", () => {
    const vector = sunVectorEquatorOfDate(new Date("2026-08-18T12:00:00Z"));
    expect(Math.hypot(vector.x, vector.y, vector.z)).toBeGreaterThan(0.9);
    expect(Math.hypot(vector.x, vector.y, vector.z)).toBeLessThan(1.1);
  });

  it("reports geometric day and night solar altitudes", () => {
    const observer = { latitude: 34.0522, longitude: -118.2437 };
    expect(observerSolarAltitude(observer, new Date("2026-06-21T20:00:00Z"))).toBeGreaterThan(60);
    expect(observerSolarAltitude(observer, new Date("2026-06-21T08:00:00Z"))).toBeLessThan(-20);
  });

  it("groups contiguous samples and rejects passes shorter than one minute", () => {
    const base = new Date("2026-08-18T03:00:00Z").getTime();
    const sample = (seconds: number, elevationDegrees: number, azimuthDegrees = 90) => ({
      time: new Date(base + seconds * 1000), elevationDegrees, azimuthDegrees,
    });
    const passes = groupPassSamples(
      { noradId: "25544", objectName: "ISS (ZARYA)" },
      [[sample(0, 11), sample(30, 30), sample(60, 20)], [sample(120, 12), sample(150, 14)]],
    );
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ durationSeconds: 60, peakElevationDegrees: 30, peakAzimuthCompass: "E" });
  });
});
