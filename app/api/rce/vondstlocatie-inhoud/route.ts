import { fetchVondstlocatieInhoud } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";
const VONDSTLOCATIE_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/vondstlocatie\/\d+$/;
// Minstens 5 parallelle SPARQL-aanroepen per verzoek (3 inhoudsklassen +
// telling + concept-resolutie) - zonder limiter een amplificatievector
// tegen RCE (securityassessment 17-08-2026).
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.vondstlocatie-inhoud.error" }, async (startedAt) => {
    const locatie = new URL(request.url).searchParams.get("locatie") ?? "";
    if (!VONDSTLOCATIE_URI_PATTERN.test(locatie)) return Response.json({ error: "Ongeldige vondstlocatie-URI." }, { status: 400 });
    if (!rateLimiter.consume(request)) return rateLimitedResponse();
    return Response.json(await fetchVondstlocatieInhoud(locatie, request.signal), {
      headers: { "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects), "Server-Timing": `rce;dur=${Date.now() - startedAt}` },
    });
  });
}
