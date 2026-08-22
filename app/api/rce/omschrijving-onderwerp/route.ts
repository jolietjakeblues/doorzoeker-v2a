import { fetchOmschrijvingOnderwerp } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een RCE CHO-rijksmonument-URI toestaan, geen willekeurige tekst: de
// query interpoleert deze waarde direct in een SPARQL <...>-node, dus een
// waarde met een ">" erin zou een injectie mogelijk maken.
const CHO_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/\d+$/;
// Lazy, één record tegelijk (zie buildOmschrijvingOnderwerpQuery in
// lib/rce/monuments.ts) - elke aanroep triggert een eigen SPARQL-aanroep
// tegen RCE, zelfde discipline als de andere lazy-detail-routes.
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.omschrijving-onderwerp.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const cho = url.searchParams.get("cho") ?? "";
    if (!CHO_URI_PATTERN.test(cho)) {
      return Response.json({ error: "Ongeldige CHO-URI." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const concepten = await fetchOmschrijvingOnderwerp(cho, request.signal);
    return Response.json({ concepten }, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
