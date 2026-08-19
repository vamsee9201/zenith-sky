import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/server/catalog";
import type { ApiError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Catalog refresh failed", error);
    const body: ApiError = {
      error: {
        code: "CATALOG_UNAVAILABLE",
        message: "The satellite catalog is temporarily unavailable.",
      },
    };
    return NextResponse.json(body, { status: 503 });
  }
}

