import { fetchOnderzoeksgebiedVerrijking } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een RCE CHO-onderzoeksgebied-URI toestaan, geen willekeurige tekst:
// de query interpoleert deze waarde direct in een SPARQL <...>-node, dus een
// waarde met een ">" erin zou een injectie mogelijk maken.
const GEBIED_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/archeologischonderzoeksgebied\/\d+$/;
// Deze route triggert intern minstens 3 parallelle SPARQL-aanroepen per
// verzoek (complexen, vondstlocaties, aggregaten) - zonder limiter is dat
// een amplificatievector tegen RCE (securityassessment 17-08-2026).
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.onderzoeksgebied-verrijking.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const gebied = url.searchParams.get("gebied") ?? "";
    if (!GEBIED_URI_PATTERN.test(gebied)) {
      return Response.json({ error: "Ongeldige onderzoeksgebied-URI." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const verrijking = await fetchOnderzoeksgebiedVerrijking(gebied, request.signal);
    return Response.json(verrijking, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
