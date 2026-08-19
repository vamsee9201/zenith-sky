import { NextResponse } from "next/server";
import { dossierRequestSchema } from "@/lib/dossier-schema";
import { getDossier } from "@/lib/server/dossier";
import type { ApiError } from "@/lib/types";

export const runtime = "nodejs";

function error(code: string, message: string, status: number) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return error("INVALID_JSON", "The request body must be valid JSON.", 400);
  }

  const parsed = dossierRequestSchema.safeParse(value);
  if (!parsed.success) return error("INVALID_REQUEST", "A valid NORAD ID is required.", 400);

  try {
    const dossier = await getDossier(parsed.data.noradId);
    if (!dossier) return error("OBJECT_NOT_FOUND", "That object is not in the visual catalog.", 404);
    return NextResponse.json(dossier);
  } catch (cause) {
    console.error("Dossier generation failed", cause);
    return error("DOSSIER_UNAVAILABLE", "The object brief is temporarily unavailable.", 502);
  }
}

