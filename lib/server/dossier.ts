import "server-only";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { dossierSchema } from "@/lib/dossier-schema";
import { getCatalog } from "@/lib/server/catalog";
import type { CatalogObject, Dossier } from "@/lib/types";

const dossierCache = new Map<string, Dossier>();
const dossierRequests = new Map<string, Promise<Dossier>>();
let vertexClient: GoogleGenAI | null = null;

function rcsClass(rcs: number | null | undefined) {
  if (rcs === null || rcs === undefined) return "UNKNOWN";
  if (rcs < 0.1) return "SMALL";
  if (rcs < 1) return "MEDIUM";
  return "LARGE";
}

export function createDossierPrompt(object: CatalogObject) {
  const metadata = object.metadata;
  return `You are writing a short factual brief on an object in Earth orbit for someone who just saw it listed as passing overhead.

Treat the catalog record below as authoritative. Do not contradict it.

CATALOG RECORD:
  norad_id: ${object.noradId}
  object_name: ${object.objectName}
  object_type: ${metadata?.objectType ?? "UNK"}
  country_of_origin: ${metadata?.owner ?? "unknown"}
  launch_date: ${metadata?.launchDate ?? "unknown"}
  rcs_size: ${rcsClass(metadata?.rcsSquareMeters)}
  apogee_km: ${metadata?.apogeeKm ?? "unknown"}
  perigee_km: ${metadata?.perigeeKm ?? "unknown"}
  inclination_deg: ${metadata?.inclinationDegrees ?? object.omm.inclination}

Write a brief with these fields:
- whatItIs: One sentence in plain language. R/B means a spent rocket stage, DEB means a fragment, and PAY means a payload.
- operator: Who launched or operates it, only if identifiable from the name and country; otherwise null.
- purpose: What it does or did. For debris and rocket bodies, identify the source mission only if known; otherwise null.
- story: Two or three sentences of genuinely interesting factual context.
- confidence: "high", "medium", or "low".

Rules:
- Generic designators and obscure objects must be described honestly. Say what is unknown, set confidence to low, and never invent a mission, operator, breakup event, or launch history.
- Use orbital parameters and launch date only for claims they directly support.
- Do not repeat the entire raw record; the interface already displays it.
- No speculation presented as fact.`;
}

export function enforceCatalogUncertainty(object: CatalogObject, dossier: Dossier): Dossier {
  const type = object.metadata?.objectType;
  const genericName = /(?:^|\s)(?:SL-\d+|CZ-\d+|H-\d+|R\/B|DEB)(?:\s|$)/i.test(object.objectName);
  if (!genericName || (type !== "R/B" && type !== "DEB")) return dossier;
  return {
    ...dossier,
    operator: null,
    purpose: null,
    confidence: "low",
  };
}

function client() {
  if (vertexClient) return vertexClient;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not configured");
  vertexClient = new GoogleGenAI({ vertexai: true, project, location });
  return vertexClient;
}

export async function generateDossier(object: CatalogObject): Promise<Dossier> {
  const response = await client().models.generateContent({
    model: process.env.VERTEX_MODEL || "gemini-3.1-flash-lite",
    contents: createDossierPrompt(object),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          whatItIs: { type: "string" },
          operator: { anyOf: [{ type: "string" }, { type: "null" }] },
          purpose: { anyOf: [{ type: "string" }, { type: "null" }] },
          story: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["whatItIs", "operator", "purpose", "story", "confidence"],
      },
      thinkingConfig: {
        includeThoughts: false,
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
    },
  });

  if (!response.text) throw new Error("Vertex AI returned no dossier text");
  return enforceCatalogUncertainty(object, dossierSchema.parse(JSON.parse(response.text)));
}

export async function getDossier(noradId: string): Promise<Dossier | null> {
  const cached = dossierCache.get(noradId);
  if (cached) return cached;

  const catalog = await getCatalog();
  const object = catalog.objects.find((candidate) => candidate.noradId === noradId);
  if (!object) return null;

  let pending = dossierRequests.get(noradId);
  if (!pending) {
    pending = generateDossier(object)
      .then((dossier) => {
        dossierCache.set(noradId, dossier);
        return dossier;
      })
      .finally(() => dossierRequests.delete(noradId));
    dossierRequests.set(noradId, pending);
  }
  return pending;
}

export function resetDossierCacheForTests() {
  dossierCache.clear();
  dossierRequests.clear();
  vertexClient = null;
}
