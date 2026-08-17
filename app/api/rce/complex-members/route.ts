import { fetchComplexMembers } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een RCE CHO-complex-URI toestaan, geen willekeurige tekst: de query
// interpoleert deze waarde direct in een SPARQL <...>-node, dus een waarde
// met een ">" erin zou een injectie mogelijk maken.
const COMPLEX_URI_PATTERN = /^https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/complex\/\d+$/;
// De URI-vorm is strak begrensd, maar dat begrenst niet hoe vaak een
// geldig-ogend (niet per se bestaand) nummer wordt opgevraagd - elke
// aanroep triggert een eigen SPARQL-aanroep tegen RCE (securityassessment
// 17-08-2026).
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.complex-members.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const complex = url.searchParams.get("complex") ?? "";
    if (!COMPLEX_URI_PATTERN.test(complex)) {
      return Response.json({ error: "Ongeldige complex-URI." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const members = await fetchComplexMembers(complex, request.signal);
    return Response.json({ members }, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
