import { fetchWikidataItem } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een kaal rijksmonumentnummer toestaan, geen willekeurige tekst: de
// waarde wordt direct als SPARQL-stringliteral geïnterpoleerd (zie
// fetchWikidataItem in lib/server/rce-adapter.ts).
const MONUMENT_NUMBER_PATTERN = /^\d{1,6}$/;
// Zelfde budget als de andere lazy-detailroutes - zonder limiter een
// amplificatievector, nu ook richting een externe dienst (Wikidata) i.p.v.
// alleen RCE.
const rateLimiter = createRateLimiter(30);

export async function GET(request: Request) {
  return withRceErrorHandling(
    { event: "rce.wikidata.error", message: "Wikidata is momenteel niet bereikbaar." },
    async (startedAt) => {
      const monumentNumber = new URL(request.url).searchParams.get("rijksmonumentnummer") ?? "";
      if (!MONUMENT_NUMBER_PATTERN.test(monumentNumber)) {
        return Response.json({ error: "Ongeldig rijksmonumentnummer." }, { status: 400 });
      }
      if (!rateLimiter.consume(request)) return rateLimitedResponse();

      const item = await fetchWikidataItem(monumentNumber, request.signal);
      return Response.json(
        { item },
        {
          headers: {
            "Cache-Control": sharedCacheControl(CACHE_POLICY.relatedObjects),
            "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
          },
        },
      );
    },
  );
}
