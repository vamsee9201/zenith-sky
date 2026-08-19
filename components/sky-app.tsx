"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { objectsOverhead } from "@/lib/orbit";
import { dossierSchema } from "@/lib/dossier-schema";
import {
  FEATURED_CITIES,
  OTHER_US_CITIES,
  findUsCity,
  formatCityName,
} from "@/lib/us-cities";
import { SkyDome } from "@/components/sky-dome";
import type {
  CatalogObject,
  CatalogResponse,
  Dossier,
  Observer,
  PassWorkerRequest,
  PassWorkerResponse,
  VisiblePass,
} from "@/lib/types";

const LOS_ANGELES: Observer = { latitude: 34.0522, longitude: -118.2437 };
const LOCATION_STORAGE_KEY = "zenith-observer-v1";
type Tab = "overhead" | "tonight";
type LocationSource = "fallback" | "device" | "manual" | "city";
interface SavedLocationV2 {
  version: 2;
  observer: Observer;
  source: "device" | "manual";
  accuracyMeters: number | null;
  capturedAt: string;
}
interface SavedLocationV3 {
  version: 3;
  observer: Observer;
  source: Exclude<LocationSource, "fallback">;
  accuracyMeters: number | null;
  capturedAt: string;
  cityId?: string;
}
type SavedLocation = SavedLocationV2 | SavedLocationV3;
type DossierState =
  | { status: "loading" }
  | { status: "ready"; data: Dossier }
  | { status: "error"; message: string };
type PassState =
  | { status: "idle" | "loading" }
  | { status: "ready"; passes: VisiblePass[] }
  | { status: "error"; message: string };

function formatUpdatedAt(value: string | null) {
  if (!value) return "Waiting for catalog";
  return `Catalog ${new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value))}`;
}

function validObserver(value: unknown): value is Observer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Observer>;
  return Number.isFinite(candidate.latitude) && candidate.latitude! >= -90 && candidate.latitude! <= 90 &&
    Number.isFinite(candidate.longitude) && candidate.longitude! >= -180 && candidate.longitude! <= 180;
}

function parseSavedLocation(value: unknown): SavedLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    version?: unknown;
    observer?: unknown;
    source?: unknown;
    accuracyMeters?: unknown;
    capturedAt?: unknown;
    cityId?: unknown;
  };
  const hasValidAccuracy = candidate.accuracyMeters === null ||
    (typeof candidate.accuracyMeters === "number" && Number.isFinite(candidate.accuracyMeters) && candidate.accuracyMeters >= 0);
  if (!validObserver(candidate.observer) || !hasValidAccuracy || typeof candidate.capturedAt !== "string") {
    return null;
  }
  if (candidate.version === 2 && (candidate.source === "device" || candidate.source === "manual")) {
    return {
      version: 2,
      observer: candidate.observer,
      source: candidate.source,
      accuracyMeters: candidate.accuracyMeters as number | null,
      capturedAt: candidate.capturedAt,
    };
  }
  if (candidate.version === 3 &&
      (candidate.source === "device" || candidate.source === "manual" || candidate.source === "city")) {
    return {
      version: 3,
      observer: candidate.observer,
      source: candidate.source,
      accuracyMeters: candidate.accuracyMeters as number | null,
      capturedAt: candidate.capturedAt,
      ...(typeof candidate.cityId === "string" ? { cityId: candidate.cityId } : {}),
    };
  }
  return null;
}

function formatAccuracy(accuracyMeters: number) {
  if (accuracyMeters < 1_000) return `${Math.round(accuracyMeters)} m`;
  return `${(accuracyMeters / 1_000).toFixed(accuracyMeters < 10_000 ? 1 : 0)} km`;
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED || error.code === 1) {
    return "Location permission was denied. The manual coordinates remain active.";
  }
  if (error.code === error.TIMEOUT || error.code === 3) {
    return "Precise location timed out. Retry or enter coordinates manually.";
  }
  return "Location was unavailable. The manual coordinates remain active.";
}

export function SkyApp() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [observer, setObserver] = useState<Observer>(LOS_ANGELES);
  const [latitudeInput, setLatitudeInput] = useState(String(LOS_ANGELES.latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(LOS_ANGELES.longitude));
  const [locationLabel, setLocationLabel] = useState("Los Angeles fallback");
  const [locationSource, setLocationSource] = useState<LocationSource>("fallback");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<Tab>("overhead");
  const [expandedNoradId, setExpandedNoradId] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<Record<string, DossierState>>({});
  const [passState, setPassState] = useState<PassState>({ status: "idle" });

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return;
    let hydrationTimer: number | undefined;
    try {
      const parsed = JSON.parse(stored) as unknown;
      const saved = parseSavedLocation(parsed);
      const restoredObserver = saved?.observer ?? parsed;
      if (validObserver(restoredObserver)) {
        const savedCity = saved?.version === 3 && saved.source === "city"
          ? findUsCity(saved.cityId)
          : undefined;
        const restoredSource = saved?.source === "city" && !savedCity
          ? "manual"
          : saved?.source ?? "manual";
        hydrationTimer = window.setTimeout(() => {
          setObserver(restoredObserver);
          setLatitudeInput(String(restoredObserver.latitude));
          setLongitudeInput(String(restoredObserver.longitude));
          setSelectedCityId(savedCity?.id ?? "");
          setLocationSource(restoredSource);
          setLocationAccuracy(restoredSource === "device" ? saved?.accuracyMeters ?? null : null);
          setLocationLabel(savedCity
            ? `${formatCityName(savedCity)} city center`
            : restoredSource === "device" ? "Saved device location" : "Saved location");
        }, 0);
      }
    } catch {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
    return () => {
      if (hydrationTimer !== undefined) window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog", { signal: controller.signal });
        const body = (await response.json()) as CatalogResponse | { error?: { message?: string } };
        if (!response.ok || !("objects" in body)) {
          throw new Error("error" in body ? body.error?.message : "Catalog request failed");
        }
        setCatalog(body);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogError(error instanceof Error ? error.message : "Catalog request failed");
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab !== "tonight" || !catalog) return;
    const worker = new Worker(new URL("../workers/visible-passes.worker.ts", import.meta.url));
    const requestId = `${Date.now()}-${Math.random()}`;
    setPassState({ status: "loading" });
    worker.onmessage = (event: MessageEvent<PassWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;
      if (event.data.type === "result") setPassState({ status: "ready", passes: event.data.passes });
      else setPassState({ status: "error", message: event.data.message });
    };
    worker.onerror = () => setPassState({ status: "error", message: "The pass calculator could not start." });
    const request: PassWorkerRequest = {
      type: "predict",
      requestId,
      objects: catalog.objects,
      observer,
      calculationTime: new Date().toISOString(),
    };
    worker.postMessage(request);
    return () => worker.terminate();
  }, [activeTab, catalog, observer]);

  const overhead = useMemo(
    () => (catalog ? objectsOverhead(catalog.objects, observer, now) : []),
    [catalog, observer, now],
  );

  function useCurrentLocation() {
    setLocationMessage(null);
    if (!("geolocation" in navigator)) {
      setLocationMessage("This browser does not provide location. Enter coordinates below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: Number(position.coords.latitude.toFixed(5)),
          longitude: Number(position.coords.longitude.toFixed(5)),
        };
        const accuracyMeters = Number.isFinite(position.coords.accuracy)
          ? Math.max(0, Math.round(position.coords.accuracy))
          : null;
        const saved: SavedLocationV3 = {
          version: 3,
          observer: next,
          source: "device",
          accuracyMeters,
          capturedAt: new Date(Number.isFinite(position.timestamp) ? position.timestamp : Date.now()).toISOString(),
        };
        setObserver(next);
        setLatitudeInput(String(next.latitude));
        setLongitudeInput(String(next.longitude));
        setSelectedCityId("");
        setLocationLabel("Current location");
        setLocationSource("device");
        setLocationAccuracy(accuracyMeters);
        window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));
        if (accuracyMeters !== null && accuracyMeters > 5_000) {
          setLocationMessage(`Location is approximate (accurate to about ${formatAccuracy(accuracyMeters)}). Retry outdoors or enter coordinates.`);
        } else {
          setLocationMessage(accuracyMeters === null
            ? "Location updated and saved on this device."
            : `Location updated. Accurate to about ${formatAccuracy(accuracyMeters)}.`);
        }
        setLocating(false);
      },
      (error) => {
        setLocationMessage(locationErrorMessage(error));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  function saveManualLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setLocationMessage("Latitude must be between −90 and 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setLocationMessage("Longitude must be between −180 and 180.");
      return;
    }
    const next = { latitude, longitude };
    const selectedCity = findUsCity(selectedCityId);
    const cityMatchesInputs = selectedCity?.latitude === latitude && selectedCity.longitude === longitude;
    const saved: SavedLocationV3 = {
      version: 3,
      observer: next,
      source: cityMatchesInputs ? "city" : "manual",
      accuracyMeters: null,
      capturedAt: new Date().toISOString(),
      ...(cityMatchesInputs ? { cityId: selectedCity.id } : {}),
    };
    setObserver(next);
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));
    setLocationSource(saved.source);
    setLocationAccuracy(null);
    setLocationLabel(cityMatchesInputs
      ? `${formatCityName(selectedCity)} city center`
      : "Saved manual location");
    setLocationMessage(cityMatchesInputs
      ? `${formatCityName(selectedCity)} city center saved on this device.`
      : "Manual location saved on this device.");
  }

  function selectCity(cityId: string) {
    setSelectedCityId(cityId);
    const city = findUsCity(cityId);
    if (!city) return;
    setLatitudeInput(String(city.latitude));
    setLongitudeInput(String(city.longitude));
    setLocationMessage(`Coordinates loaded for ${formatCityName(city)}. Select Save to apply.`);
  }

  function updateCoordinateInput(field: "latitude" | "longitude", value: string) {
    setSelectedCityId("");
    if (field === "latitude") setLatitudeInput(value);
    else setLongitudeInput(value);
  }

  function clearSavedLocation() {
    window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    setObserver(LOS_ANGELES);
    setLatitudeInput(String(LOS_ANGELES.latitude));
    setLongitudeInput(String(LOS_ANGELES.longitude));
    setSelectedCityId("");
    setLocationLabel("Los Angeles fallback");
    setLocationSource("fallback");
    setLocationAccuracy(null);
    setLocationMessage("Saved location cleared. Using the Los Angeles example fallback.");
  }

  async function loadDossier(noradId: string, force = false) {
    setExpandedNoradId((current) => current === noradId && !force ? null : noradId);
    if (!force && dossiers[noradId]) return;

    const storageKey = `zenith-dossier-${noradId}`;
    if (!force) {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = dossierSchema.safeParse(JSON.parse(saved));
          if (parsed.success) {
            setDossiers((current) => ({ ...current, [noradId]: { status: "ready", data: parsed.data } }));
            return;
          }
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    setDossiers((current) => ({ ...current, [noradId]: { status: "loading" } }));
    try {
      const response = await fetch("/api/dossier", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noradId }),
      });
      const body = (await response.json()) as unknown;
      const parsed = dossierSchema.safeParse(body);
      if (!response.ok || !parsed.success) throw new Error("The object brief is temporarily unavailable.");
      window.localStorage.setItem(storageKey, JSON.stringify(parsed.data));
      setDossiers((current) => ({ ...current, [noradId]: { status: "ready", data: parsed.data } }));
    } catch (error) {
      setDossiers((current) => ({
        ...current,
        [noradId]: {
          status: "error",
          message: error instanceof Error ? error.message : "The object brief is temporarily unavailable.",
        },
      }));
    }
  }

  function catalogObject(noradId: string): CatalogObject | undefined {
    return catalog?.objects.find((object) => object.noradId === noradId);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">ZENITH SKY</p><h1>What&apos;s up there?</h1></div>
        <div className="live-mark" aria-label="Live calculations"><span /> LIVE</div>
      </header>

      <section className="location-card" aria-labelledby="location-heading">
        <div className="location-summary">
          <div>
            <p className="section-kicker" id="location-heading">OBSERVER</p>
            <strong>{locationLabel}</strong>
            <span>{observer.latitude.toFixed(4)}°, {observer.longitude.toFixed(4)}°</span>
            {locationAccuracy !== null && <span className="location-accuracy">Accurate to about {formatAccuracy(locationAccuracy)}</span>}
          </div>
          <button className="locate-button" type="button" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Locating…" : locationSource === "device" ? "Refresh location" : "Use my location"}
          </button>
        </div>
        <details className="manual-location">
          <summary>Choose a city or enter coordinates</summary>
          <form onSubmit={saveManualLocation}>
            <label className="city-picker">U.S. city
              <select
                value={selectedCityId}
                aria-describedby="city-coordinate-note"
                onChange={(event) => selectCity(event.target.value)}
              >
                <option value="">Choose a city…</option>
                <optgroup label="Featured cities">
                  {FEATURED_CITIES.map((city) => <option key={city.id} value={city.id}>{formatCityName(city)}</option>)}
                </optgroup>
                <optgroup label="More large U.S. cities">
                  {OTHER_US_CITIES.map((city) => <option key={city.id} value={city.id}>{formatCityName(city)}</option>)}
                </optgroup>
              </select>
            </label>
            <p className="city-coordinate-note" id="city-coordinate-note">City choices use approximate city-center coordinates. Use my location for precise coordinates.</p>
            <label>Latitude<input inputMode="decimal" value={latitudeInput} onChange={(event) => updateCoordinateInput("latitude", event.target.value)} /></label>
            <label>Longitude<input inputMode="decimal" value={longitudeInput} onChange={(event) => updateCoordinateInput("longitude", event.target.value)} /></label>
            <button type="submit">Save</button>
          </form>
          {locationSource !== "fallback" && <button className="clear-location" type="button" onClick={clearSavedLocation}>Clear saved location</button>}
        </details>
        {locationMessage && <p className="inline-message" role="status">{locationMessage}</p>}
      </section>

      <nav className="view-tabs" aria-label="Sky views">
        <button type="button" className={activeTab === "overhead" ? "active" : ""} aria-pressed={activeTab === "overhead"} onClick={() => setActiveTab("overhead")}>Overhead <span>{catalog ? overhead.length : "—"}</span></button>
        <button type="button" className={activeTab === "tonight" ? "active" : ""} aria-pressed={activeTab === "tonight"} onClick={() => setActiveTab("tonight")}>Tonight {passState.status === "ready" && <span>{passState.passes.length}</span>}</button>
      </nav>

      {activeTab === "overhead" ? (
        <section className="sky-panel" aria-labelledby="overhead-heading">
          <div className="panel-heading">
            <div><p className="section-kicker">ABOVE 0° NOW</p><h2 id="overhead-heading">Bright catalog overhead</h2></div>
            <time suppressHydrationWarning dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
          </div>
          {catalogError && <div className="empty-state error-state" role="alert"><strong>Catalog unavailable</strong><p>{catalogError}</p></div>}
          {!catalog && !catalogError && <div className="loading-list" aria-label="Loading satellite catalog"><span /><span /><span /></div>}
          {catalog && <SkyDome overhead={overhead} />}
          {catalog && overhead.length === 0 && <div className="empty-state"><strong>No bright objects above your horizon right now.</strong><p>The sky changes quickly—check Tonight for the next visible pass.</p></div>}
          {overhead.length > 0 && (
            <ol className="object-list">
              {overhead.map((object) => (
                <li key={object.noradId}>
                  <button
                    className="object-button"
                    type="button"
                    aria-expanded={expandedNoradId === object.noradId}
                    onClick={() => void loadDossier(object.noradId)}
                  >
                    <div className="object-rank" aria-hidden="true">{Math.round(object.elevationDegrees)}°</div>
                    <div className="object-main"><strong>{object.objectName}</strong><span>NORAD {object.noradId} · {Math.round(object.rangeKm).toLocaleString()} km</span></div>
                    <div className="object-direction"><strong>{object.azimuthCompass}</strong><span>{Math.round(object.azimuthDegrees)}° · {object.motion}</span></div>
                  </button>
                  {expandedNoradId === object.noradId && (
                    <DossierPanel
                      state={dossiers[object.noradId]}
                      object={catalogObject(object.noradId)}
                      onRetry={() => void loadDossier(object.noradId, true)}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
          <footer className="catalog-note"><span className={catalog?.stale ? "status-dot stale" : "status-dot"} />{formatUpdatedAt(catalog?.updatedAt ?? null)}{catalog?.stale ? " · saved snapshot" : " · current"}</footer>
        </section>
      ) : (
        <section className="sky-panel" aria-labelledby="tonight-heading">
          <div className="panel-heading">
            <div><p className="section-kicker">NEXT 24 HOURS</p><h2 id="tonight-heading">Visible bright-catalog passes</h2></div>
          </div>
          {(passState.status === "idle" || passState.status === "loading") && (
            <div className="pass-loading" role="status"><span /><strong>Calculating on your device…</strong><p>Checking darkness, elevation, and Earth shadow for every bright-catalog object.</p></div>
          )}
          {passState.status === "error" && <div className="empty-state error-state" role="alert"><strong>Pass calculation failed</strong><p>{passState.message}</p></div>}
          {passState.status === "ready" && passState.passes.length === 0 && <div className="empty-state"><strong>No qualifying pass in the next 24 hours.</strong><p>Try a different observer location or check again after the catalog refreshes.</p></div>}
          {passState.status === "ready" && passState.passes.length > 0 && <><SkyDome passes={passState.passes} /><PassList passes={passState.passes} /></>}
          <footer className="pass-note">These objects belong to the bright visual catalog. Actual brightness varies with distance, attitude, atmosphere, and surroundings.</footer>
        </section>
      )}
      <p className="privacy-note">Your coordinates stay in this browser. Orbital calculations run on your device.</p>
    </main>
  );
}

function PassList({ passes }: { passes: VisiblePass[] }) {
  const time = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return (
    <ol className="pass-list">
      {passes.map((pass) => (
        <li key={`${pass.noradId}-${pass.startTime}`}>
          <div className="pass-time"><strong>{time(pass.startTime)}</strong><span>{Math.round(pass.durationSeconds / 60)} min</span></div>
          <div className="pass-main"><strong>{pass.objectName}</strong><span>NORAD {pass.noradId} · peaks {Math.round(pass.peakElevationDegrees)}°</span></div>
          <div className="pass-direction"><strong>{pass.startAzimuthCompass} → {pass.endAzimuthCompass}</strong><span>appears → fades</span></div>
        </li>
      ))}
    </ol>
  );
}

function DossierPanel({ state, object, onRetry }: {
  state: DossierState | undefined;
  object: CatalogObject | undefined;
  onRetry: () => void;
}) {
  if (!state || state.status === "loading") {
    return <div className="dossier dossier-loading" role="status">Asking Vertex AI for a grounded brief…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="dossier dossier-error" role="alert">
        <strong>Catalog facts only</strong>
        <p>{object?.metadata?.objectType ?? "Unknown type"} · {object?.metadata?.owner ?? "Owner unknown"} · launched {object?.metadata?.launchDate ?? "date unknown"}</p>
        <span>{state.message}</span>
        <button type="button" onClick={onRetry}>Retry brief</button>
      </div>
    );
  }
  const { data } = state;
  return (
    <div className="dossier">
      <div className="dossier-heading"><span>VERTEX DOSSIER</span><span className={`confidence ${data.confidence}`}>{data.confidence} confidence</span></div>
      <strong>{data.whatItIs}</strong>
      {(data.operator || data.purpose) && (
        <dl>
          {data.operator && <><dt>Operator</dt><dd>{data.operator}</dd></>}
          {data.purpose && <><dt>Purpose</dt><dd>{data.purpose}</dd></>}
        </dl>
      )}
      <p>{data.story}</p>
    </div>
  );
}
