"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { objectsOverhead } from "@/lib/orbit";
import { dossierSchema } from "@/lib/dossier-schema";
import type { CatalogObject, CatalogResponse, Dossier, Observer } from "@/lib/types";

const LOS_ANGELES: Observer = { latitude: 34.0522, longitude: -118.2437 };
const LOCATION_STORAGE_KEY = "zenith-observer-v1";
type Tab = "overhead" | "tonight";
type DossierState =
  | { status: "loading" }
  | { status: "ready"; data: Dossier }
  | { status: "error"; message: string };

function formatUpdatedAt(value: string | null) {
  if (!value) return "Waiting for catalog";
  return `Catalog ${new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value))}`;
}

export function SkyApp() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [observer, setObserver] = useState<Observer>(LOS_ANGELES);
  const [latitudeInput, setLatitudeInput] = useState(String(LOS_ANGELES.latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(LOS_ANGELES.longitude));
  const [locationLabel, setLocationLabel] = useState("Los Angeles fallback");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<Tab>("overhead");
  const [expandedNoradId, setExpandedNoradId] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<Record<string, DossierState>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return;
    let hydrationTimer: number | undefined;
    try {
      const parsed = JSON.parse(stored) as Observer;
      if (
        Number.isFinite(parsed.latitude) && parsed.latitude >= -90 && parsed.latitude <= 90 &&
        Number.isFinite(parsed.longitude) && parsed.longitude >= -180 && parsed.longitude <= 180
      ) {
        hydrationTimer = window.setTimeout(() => {
          setObserver(parsed);
          setLatitudeInput(String(parsed.latitude));
          setLongitudeInput(String(parsed.longitude));
          setLocationLabel("Saved location");
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
        setObserver(next);
        setLatitudeInput(String(next.latitude));
        setLongitudeInput(String(next.longitude));
        setLocationLabel("Current location");
        setLocationMessage("Location updated. It stays on this device.");
        setLocating(false);
      },
      () => {
        setLocationMessage("Location was unavailable. The manual coordinates remain active.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
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
    setObserver(next);
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
    setLocationLabel("Saved location");
    setLocationMessage("Manual location saved on this device.");
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
          </div>
          <button className="locate-button" type="button" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        <details className="manual-location">
          <summary>Enter coordinates</summary>
          <form onSubmit={saveManualLocation}>
            <label>Latitude<input inputMode="decimal" value={latitudeInput} onChange={(event) => setLatitudeInput(event.target.value)} /></label>
            <label>Longitude<input inputMode="decimal" value={longitudeInput} onChange={(event) => setLongitudeInput(event.target.value)} /></label>
            <button type="submit">Save</button>
          </form>
        </details>
        {locationMessage && <p className="inline-message" role="status">{locationMessage}</p>}
      </section>

      <nav className="view-tabs" aria-label="Sky views">
        <button type="button" className={activeTab === "overhead" ? "active" : ""} aria-pressed={activeTab === "overhead"} onClick={() => setActiveTab("overhead")}>Overhead <span>{catalog ? overhead.length : "—"}</span></button>
        <button type="button" className={activeTab === "tonight" ? "active" : ""} aria-pressed={activeTab === "tonight"} onClick={() => setActiveTab("tonight")}>Tonight</button>
      </nav>

      {activeTab === "overhead" ? (
        <section className="sky-panel" aria-labelledby="overhead-heading">
          <div className="panel-heading">
            <div><p className="section-kicker">ABOVE 0° NOW</p><h2 id="overhead-heading">Bright catalog overhead</h2></div>
            <time suppressHydrationWarning dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
          </div>
          {catalogError && <div className="empty-state error-state" role="alert"><strong>Catalog unavailable</strong><p>{catalogError}</p></div>}
          {!catalog && !catalogError && <div className="loading-list" aria-label="Loading satellite catalog"><span /><span /><span /></div>}
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
        <section className="sky-panel tonight-placeholder" aria-labelledby="tonight-heading">
          <p className="section-kicker">NEXT 24 HOURS</p><h2 id="tonight-heading">Visible passes are coming next.</h2><p>We&apos;ll filter for darkness, elevation, and sunlight—being overhead alone is not enough.</p>
        </section>
      )}
      <p className="privacy-note">Your coordinates stay in this browser. Orbital calculations run on your device.</p>
    </main>
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
