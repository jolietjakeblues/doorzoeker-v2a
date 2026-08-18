import { fetchLigtIn } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een kaal rijksmonumentnummer toestaan, geen willekeurige tekst: de
// waarde wordt direct als SPARQL-stringliteral geïnterpoleerd (zie
// buildGezichtLidmaatschapQuery/buildWerelderfgoedLidmaatschapQuery).
const MONUMENT_NUMBER_PATTERN = /^\d{1,6}$/;
// Twee SPARQL-aanroepen per verzoek (Gezicht + Werelderfgoed, parallel) -
// zonder limiter een amplificatievector tegen RCE (zelfde discipline als de
// andere lazy-detail-routes).
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.ligt-in.error" }, async (startedAt) => {
    const monumentNumber = new URL(request.url).searchParams.get("rijksmonumentnummer") ?? "";
    if (!MONUMENT_NUMBER_PATTERN.test(monumentNumber)) {
      return Response.json({ error: "Ongeldig rijksmonumentnummer." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const ligtIn = await fetchLigtIn(monumentNumber, request.signal);
    return Response.json(ligtIn, {
      headers: {
        "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
  });
}
