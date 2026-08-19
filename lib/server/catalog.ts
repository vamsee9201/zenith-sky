import "server-only";

import { joinCatalog } from "@/lib/catalog-normalize";
import { rawOmmArraySchema, rawSatcatArraySchema, type RawOmm, type RawSatcat } from "@/lib/schemas";
import type { CatalogResponse } from "@/lib/types";
import seedJson from "@/data/celestrak-seed.json";

const GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=JSON";
const SATCAT_URL = "https://celestrak.org/satcat/records.php?GROUP=visual&FORMAT=JSON";
const GP_TTL_MS = 6 * 60 * 60 * 1000;
const SATCAT_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_SPACING_MS = 1_050;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  sourceUpdatedAt?: number;
  fallback?: boolean;
}

let gpCache: CacheEntry<RawOmm[]> | null = null;
let satcatCache: CacheEntry<RawSatcat[]> | null = null;
let gpRefresh: Promise<CacheEntry<RawOmm[]>> | null = null;
let satcatRefresh: Promise<CacheEntry<RawSatcat[]>> | null = null;
let lastUpstreamRequestAt = 0;
let pacingQueue: Promise<void> = Promise.resolve();

type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

const parsedSeed = (() => {
  const seed = seedJson as { fetchedAt: string; omm: unknown; satcat: unknown };
  return {
    fetchedAt: new Date(seed.fetchedAt).getTime(),
    omm: rawOmmArraySchema.parse(seed.omm),
    satcat: rawSatcatArraySchema.parse(seed.satcat),
  };
})();

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function pacedFetch(url: string, fetcher: FetchLike, sleep: Sleep) {
  const previous = pacingQueue;
  let release!: () => void;
  pacingQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, REQUEST_SPACING_MS - (Date.now() - lastUpstreamRequestAt));
    if (waitMs > 0) await sleep(waitMs);
    lastUpstreamRequestAt = Date.now();
    return await fetcher(url, {
      headers: { "User-Agent": "zenith-sky/0.1 (personal satellite visibility app)" },
      cache: "no-store",
    });
  } finally {
    release();
  }
}

async function refreshGp(fetcher: FetchLike, sleep: Sleep): Promise<CacheEntry<RawOmm[]>> {
  const response = await pacedFetch(GP_URL, fetcher, sleep);
  if (!response.ok) throw new Error(`CelesTrak GP request failed with ${response.status}`);
  const data = rawOmmArraySchema.parse(await response.json());
  return { data, fetchedAt: Date.now() };
}

async function refreshSatcat(fetcher: FetchLike, sleep: Sleep): Promise<CacheEntry<RawSatcat[]>> {
  const response = await pacedFetch(SATCAT_URL, fetcher, sleep);
  if (!response.ok) throw new Error(`CelesTrak SATCAT request failed with ${response.status}`);
  const data = rawSatcatArraySchema.parse(await response.json());
  return { data, fetchedAt: Date.now() };
}

async function loadGp(now: number, fetcher: FetchLike, sleep: Sleep) {
  if (gpCache && now - gpCache.fetchedAt < GP_TTL_MS) {
    return { entry: gpCache, stale: Boolean(gpCache.fallback) };
  }
  gpRefresh ??= refreshGp(fetcher, sleep).finally(() => {
    gpRefresh = null;
  });
  try {
    gpCache = await gpRefresh;
    return { entry: gpCache, stale: false };
  } catch (error) {
    if (gpCache) return { entry: gpCache, stale: true };
    throw error;
  }
}

async function loadSatcat(now: number, fetcher: FetchLike, sleep: Sleep) {
  if (satcatCache && now - satcatCache.fetchedAt < SATCAT_TTL_MS) {
    return { entry: satcatCache, stale: Boolean(satcatCache.fallback) };
  }
  satcatRefresh ??= refreshSatcat(fetcher, sleep).finally(() => {
    satcatRefresh = null;
  });
  try {
    satcatCache = await satcatRefresh;
    return { entry: satcatCache, stale: false };
  } catch (error) {
    if (satcatCache) return { entry: satcatCache, stale: true };
    throw error;
  }
}

export async function getCatalog(options: {
  now?: number;
  fetcher?: FetchLike;
  sleep?: Sleep;
  useSeedFallback?: boolean;
} = {}): Promise<CatalogResponse> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  let gp;
  let satcat;
  try {
    [gp, satcat] = await Promise.all([
      loadGp(now, fetcher, sleep),
      loadSatcat(now, fetcher, sleep),
    ]);
  } catch (error) {
    if (options.useSeedFallback === false) throw error;
    gpCache ??= {
      data: parsedSeed.omm,
      fetchedAt: now,
      sourceUpdatedAt: parsedSeed.fetchedAt,
      fallback: true,
    };
    satcatCache ??= {
      data: parsedSeed.satcat,
      fetchedAt: now,
      sourceUpdatedAt: parsedSeed.fetchedAt,
      fallback: true,
    };
    gp = { entry: gpCache, stale: true };
    satcat = { entry: satcatCache, stale: true };
  }

  return {
    updatedAt: new Date(
      Math.min(
        gp.entry.sourceUpdatedAt ?? gp.entry.fetchedAt,
        satcat.entry.sourceUpdatedAt ?? satcat.entry.fetchedAt,
      ),
    ).toISOString(),
    stale: gp.stale || satcat.stale,
    objects: joinCatalog(gp.entry.data, satcat.entry.data),
  };
}

export function resetCatalogCacheForTests() {
  gpCache = null;
  satcatCache = null;
  gpRefresh = null;
  satcatRefresh = null;
  lastUpstreamRequestAt = 0;
  pacingQueue = Promise.resolve();
}
