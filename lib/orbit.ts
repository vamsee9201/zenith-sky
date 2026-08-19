import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
  type OMMJsonObject,
} from "satellite.js";
import type { CatalogObject, Observer, OverheadSnapshot } from "@/lib/types";

export function validateObserver(observer: Observer): Observer {
  if (!Number.isFinite(observer.latitude) || observer.latitude < -90 || observer.latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90 degrees.");
  }
  if (!Number.isFinite(observer.longitude) || observer.longitude < -180 || observer.longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180 degrees.");
  }
  return observer;
}

export function toSatelliteOmm(object: CatalogObject): OMMJsonObject {
  const { omm } = object;
  return {
    OBJECT_NAME: omm.objectName,
    OBJECT_ID: omm.objectId,
    EPOCH: omm.epoch,
    MEAN_MOTION: omm.meanMotion,
    ECCENTRICITY: omm.eccentricity,
    INCLINATION: omm.inclination,
    RA_OF_ASC_NODE: omm.rightAscensionAscendingNode,
    ARG_OF_PERICENTER: omm.argumentOfPericenter,
    MEAN_ANOMALY: omm.meanAnomaly,
    EPHEMERIS_TYPE: omm.ephemerisType,
    CLASSIFICATION_TYPE: omm.classificationType,
    NORAD_CAT_ID: omm.noradId,
    ELEMENT_SET_NO: omm.elementSetNumber,
    REV_AT_EPOCH: omm.revolutionAtEpoch ?? undefined,
    BSTAR: omm.bstar,
    MEAN_MOTION_DOT: omm.meanMotionDot,
    MEAN_MOTION_DDOT: omm.meanMotionDdot,
  };
}

export function azimuthToCompass(azimuthDegrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azimuthDegrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

export function lookAnglesForObject(object: CatalogObject, observer: Observer, date: Date) {
  validateObserver(observer);
  const satrec = json2satrec(toSatelliteOmm(object));
  const state = propagate(satrec, date, { communityDecayCheckEnabled: true });
  if (!state) return null;

  const gmst = gstime(date);
  const positionEcf = eciToEcf(state.position, gmst);
  const look = ecfToLookAngles(
    {
      latitude: degreesToRadians(observer.latitude),
      longitude: degreesToRadians(observer.longitude),
      height: observer.heightKm ?? 0,
    },
    positionEcf,
  );

  return {
    positionEci: state.position,
    velocityEci: state.velocity,
    elevationDegrees: radiansToDegrees(look.elevation),
    azimuthDegrees: ((radiansToDegrees(look.azimuth) % 360) + 360) % 360,
    rangeKm: look.rangeSat,
  };
}

export function overheadSnapshot(
  object: CatalogObject,
  observer: Observer,
  date: Date,
): OverheadSnapshot | null {
  const current = lookAnglesForObject(object, observer, date);
  if (!current || current.elevationDegrees <= 0) return null;
  const future = lookAnglesForObject(object, observer, new Date(date.getTime() + 5_000));
  const delta = future ? future.elevationDegrees - current.elevationDegrees : 0;
  const motion = delta > 0.01 ? "rising" : delta < -0.01 ? "setting" : "steady";

  return {
    noradId: object.noradId,
    objectName: object.objectName,
    elevationDegrees: current.elevationDegrees,
    azimuthDegrees: current.azimuthDegrees,
    azimuthCompass: azimuthToCompass(current.azimuthDegrees),
    rangeKm: current.rangeKm,
    motion,
  };
}

export function objectsOverhead(objects: CatalogObject[], observer: Observer, date: Date) {
  return objects
    .map((object) => overheadSnapshot(object, observer, date))
    .filter((snapshot): snapshot is OverheadSnapshot => snapshot !== null)
    .sort((a, b) => b.elevationDegrees - a.elevationDegrees);
}

