import type { CatalogObject, OmmRecord, SatcatMetadata } from "@/lib/types";
import type { RawOmm, RawSatcat } from "@/lib/schemas";

export function normalizeOmm(raw: RawOmm): OmmRecord {
  return {
    objectName: raw.OBJECT_NAME,
    objectId: raw.OBJECT_ID,
    epoch: raw.EPOCH.endsWith("Z") ? raw.EPOCH : `${raw.EPOCH}Z`,
    meanMotion: raw.MEAN_MOTION,
    eccentricity: raw.ECCENTRICITY,
    inclination: raw.INCLINATION,
    rightAscensionAscendingNode: raw.RA_OF_ASC_NODE,
    argumentOfPericenter: raw.ARG_OF_PERICENTER,
    meanAnomaly: raw.MEAN_ANOMALY,
    ephemerisType: 0,
    classificationType: raw.CLASSIFICATION_TYPE,
    noradId: String(raw.NORAD_CAT_ID),
    elementSetNumber: raw.ELEMENT_SET_NO,
    revolutionAtEpoch: raw.REV_AT_EPOCH,
    bstar: raw.BSTAR,
    meanMotionDot: raw.MEAN_MOTION_DOT,
    meanMotionDdot: raw.MEAN_MOTION_DDOT,
  };
}

export function normalizeSatcat(raw: RawSatcat): SatcatMetadata {
  return {
    objectType: raw.OBJECT_TYPE,
    owner: raw.OWNER,
    launchDate: raw.LAUNCH_DATE,
    launchSite: raw.LAUNCH_SITE,
    periodMinutes: raw.PERIOD,
    inclinationDegrees: raw.INCLINATION,
    apogeeKm: raw.APOGEE,
    perigeeKm: raw.PERIGEE,
    rcsSquareMeters: raw.RCS,
    operationalStatus: raw.OPS_STATUS_CODE,
  };
}

export function joinCatalog(ommRecords: RawOmm[], satcatRecords: RawSatcat[]): CatalogObject[] {
  const metadataByNoradId = new Map(
    satcatRecords.map((record) => [String(record.NORAD_CAT_ID), normalizeSatcat(record)]),
  );

  return ommRecords.map((raw) => {
    const omm = normalizeOmm(raw);
    return {
      noradId: omm.noradId,
      objectName: omm.objectName,
      objectId: omm.objectId,
      omm,
      metadata: metadataByNoradId.get(omm.noradId) ?? null,
    };
  });
}

