import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=JSON";
const SATCAT_URL = "https://celestrak.org/satcat/records.php?GROUP=visual&FORMAT=JSON";
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), "../data/celestrak-seed.json");

async function retrieve(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "zenith-sky/0.1 (personal satellite visibility app)" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const value = await response.json();
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${url} returned no records`);
  return value;
}

const omm = await retrieve(GP_URL);
await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_100));
const satcat = await retrieve(SATCAT_URL);
const payload = { fetchedAt: new Date().toISOString(), omm, satcat };

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(`Wrote ${omm.length} OMM and ${satcat.length} SATCAT records to ${outputPath}`);

