export type ObjectType = "PAY" | "R/B" | "DEB" | "UNK";

export interface OmmRecord {
  objectName: string;
  objectId: string;
  epoch: string;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
  rightAscensionAscendingNode: number;
  argumentOfPericenter: number;
  meanAnomaly: number;
  ephemerisType: 0;
  classificationType: "U" | "C";
  noradId: string;
  elementSetNumber: number;
  revolutionAtEpoch: number | null;
  bstar: number;
  meanMotionDot: number;
  meanMotionDdot: number;
}

export interface SatcatMetadata {
  objectType: ObjectType;
  owner: string | null;
  launchDate: string | null;
  launchSite: string | null;
  periodMinutes: number | null;
  inclinationDegrees: number | null;
  apogeeKm: number | null;
  perigeeKm: number | null;
  rcsSquareMeters: number | null;
  operationalStatus: string | null;
}

export interface CatalogObject {
  noradId: string;
  objectName: string;
  objectId: string;
  omm: OmmRecord;
  metadata: SatcatMetadata | null;
}

export interface CatalogResponse {
  updatedAt: string;
  stale: boolean;
  objects: CatalogObject[];
}

export interface Observer {
  latitude: number;
  longitude: number;
  heightKm?: number;
}

export type MotionState = "rising" | "setting" | "steady";

export interface OverheadSnapshot {
  noradId: string;
  objectName: string;
  elevationDegrees: number;
  azimuthDegrees: number;
  azimuthCompass: string;
  rangeKm: number;
  motion: MotionState;
}

export interface VisiblePass {
  noradId: string;
  objectName: string;
  startTime: string;
  peakTime: string;
  endTime: string;
  durationSeconds: number;
  startAzimuthDegrees: number;
  startAzimuthCompass: string;
  peakAzimuthDegrees: number;
  peakAzimuthCompass: string;
  endAzimuthDegrees: number;
  endAzimuthCompass: string;
  peakElevationDegrees: number;
  track: Array<{ azimuthDegrees: number; elevationDegrees: number }>;
}

export interface PassWorkerRequest {
  type: "predict";
  requestId: string;
  objects: CatalogObject[];
  observer: Observer;
  calculationTime: string;
}

export type PassWorkerResponse =
  | { type: "result"; requestId: string; passes: VisiblePass[] }
  | { type: "error"; requestId: string; message: string };

export interface Dossier {
  whatItIs: string;
  operator: string | null;
  purpose: string | null;
  story: string;
  confidence: "high" | "medium" | "low";
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
