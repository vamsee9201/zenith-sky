import {
  Body,
  Equator,
  GeoVector,
  Horizon,
  Observer as AstronomyObserver,
  RotateVector,
  Rotation_EQJ_EQD,
} from "astronomy-engine";
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
  type EciVec3,
} from "satellite.js";
import { azimuthToCompass, toSatelliteOmm, validateObserver } from "@/lib/orbit";
import type { CatalogObject, Observer, VisiblePass } from "@/lib/types";

export const EARTH_SHADOW_RADIUS_KM = 6378.137;
export const PASS_STEP_MS = 30_000;
export const PREDICTION_DURATION_MS = 24 * 60 * 60 * 1000;

type Vector3 = { x: number; y: number; z: number };

export function observerSolarAltitude(observer: Observer, date: Date): number {
  validateObserver(observer);
  const place = new AstronomyObserver(observer.latitude, observer.longitude, (observer.heightKm ?? 0) * 1000);
  const equatorial = Equator(Body.Sun, date, place, true, true);
  return Horizon(date, place, equatorial.ra, equatorial.dec).altitude;
}

export function sunVectorEquatorOfDate(date: Date): Vector3 {
  const eqj = GeoVector(Body.Sun, date, false);
  const eqd = RotateVector(Rotation_EQJ_EQD(date), eqj);
  return { x: eqd.x, y: eqd.y, z: eqd.z };
}

export function isSatelliteSunlit(positionKm: Vector3, sunVector: Vector3): boolean {
  const sunLength = Math.hypot(sunVector.x, sunVector.y, sunVector.z);
  if (!Number.isFinite(sunLength) || sunLength === 0) throw new RangeError("Sun vector must be finite and non-zero.");
  const sx = sunVector.x / sunLength;
  const sy = sunVector.y / sunLength;
  const sz = sunVector.z / sunLength;
  const sunwardDistance = positionKm.x * sx + positionKm.y * sy + positionKm.z * sz;
  if (sunwardDistance >= 0) return true;
  const radiusSquared = positionKm.x ** 2 + positionKm.y ** 2 + positionKm.z ** 2;
  const perpendicularDistance = Math.sqrt(Math.max(0, radiusSquared - sunwardDistance ** 2));
  return perpendicularDistance >= EARTH_SHADOW_RADIUS_KM;
}

export interface PassSample {
  time: Date;
  azimuthDegrees: number;
  elevationDegrees: number;
}

export function groupPassSamples(
  object: Pick<CatalogObject, "noradId" | "objectName">,
  groups: PassSample[][],
): VisiblePass[] {
  return groups.flatMap((samples) => {
    if (samples.length < 2) return [];
    const first = samples[0];
    const last = samples[samples.length - 1];
    const durationSeconds = (last.time.getTime() - first.time.getTime()) / 1000;
    if (durationSeconds < 60) return [];
    const peak = samples.reduce((best, sample) => sample.elevationDegrees > best.elevationDegrees ? sample : best);
    return [{
      noradId: object.noradId,
      objectName: object.objectName,
      startTime: first.time.toISOString(),
      peakTime: peak.time.toISOString(),
      endTime: last.time.toISOString(),
      durationSeconds,
      startAzimuthDegrees: first.azimuthDegrees,
      startAzimuthCompass: azimuthToCompass(first.azimuthDegrees),
      peakAzimuthDegrees: peak.azimuthDegrees,
      peakAzimuthCompass: azimuthToCompass(peak.azimuthDegrees),
      endAzimuthDegrees: last.azimuthDegrees,
      endAzimuthCompass: azimuthToCompass(last.azimuthDegrees),
      peakElevationDegrees: peak.elevationDegrees,
      track: samples.map((sample) => ({
        azimuthDegrees: sample.azimuthDegrees,
        elevationDegrees: sample.elevationDegrees,
      })),
    }];
  });
}

export function predictVisiblePasses(
  objects: CatalogObject[],
  observer: Observer,
  calculationTime: Date,
): VisiblePass[] {
  validateObserver(observer);
  const observerGd = {
    latitude: degreesToRadians(observer.latitude),
    longitude: degreesToRadians(observer.longitude),
    height: observer.heightKm ?? 0,
  };
  const environment = Array.from(
    { length: Math.floor(PREDICTION_DURATION_MS / PASS_STEP_MS) + 1 },
    (_, index) => {
      const time = new Date(calculationTime.getTime() + index * PASS_STEP_MS);
      return {
        time,
        gmst: gstime(time),
        dark: observerSolarAltitude(observer, time) < -6,
        sun: sunVectorEquatorOfDate(time),
      };
    },
  );

  const passes = objects.flatMap((object) => {
    const satrec = json2satrec(toSatelliteOmm(object));
    const groups: PassSample[][] = [];
    let active: PassSample[] | null = null;

    for (const sample of environment) {
      const state = propagate(satrec, sample.time);
      if (!state || typeof state.position === "boolean" || typeof state.velocity === "boolean") {
        if (active) groups.push(active);
        active = null;
        continue;
      }
      const position = state.position as EciVec3<number>;
      const look = ecfToLookAngles(observerGd, eciToEcf(position, sample.gmst));
      const elevationDegrees = radiansToDegrees(look.elevation);
      const visible = sample.dark && elevationDegrees > 10 && isSatelliteSunlit(position, sample.sun);
      if (!visible) {
        if (active) groups.push(active);
        active = null;
        continue;
      }
      const azimuthDegrees = ((radiansToDegrees(look.azimuth) % 360) + 360) % 360;
      active ??= [];
      active.push({ time: sample.time, elevationDegrees, azimuthDegrees });
    }
    if (active) groups.push(active);
    return groupPassSamples(object, groups);
  });

  return passes.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
