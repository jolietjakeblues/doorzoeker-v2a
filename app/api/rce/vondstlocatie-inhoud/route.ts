import { fetchVondstlocatieInhoud } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";

export const runtime = "edge";
const VONDSTLOCATIE_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/vondstlocatie\/\d+$/;

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const locatie = new URL(request.url).searchParams.get("locatie") ?? "";
    if (!VONDSTLOCATIE_URI_PATTERN.test(locatie)) return Response.json({ error: "Ongeldige vondstlocatie-URI." }, { status: 400 });
    return Response.json(await fetchVondstlocatieInhoud(locatie, request.signal), {
      headers: { "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects), "Server-Timing": `rce;dur=${Date.now() - startedAt}` },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "rce.vondstlocatie-inhoud.error", durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "De RCE Linked Data-service is momenteel niet bereikbaar." }, { status: 502 });
  }
}
