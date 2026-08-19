import { fetchArcheologischeContext } from "../../../../lib/server/rce-adapter.ts";
import { CACHE_POLICY, sharedCacheControl } from "../../../../lib/server/http-cache.ts";
import { readCache, writeCache } from "../../../../lib/server/edge-cache.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";

export const runtime = "edge";

// Alleen een kaal rijksmonumentnummer toestaan, geen willekeurige tekst: de
// waarde wordt direct als SPARQL-stringliteral geïnterpoleerd (zie
// buildRijksmonumentGeometrieQuery/buildArcheologischeContextExacteQuery).
const MONUMENT_NUMBER_PATTERN = /^\d{1,6}$/;
// Strenger dan de standaard 30/min (017-archeologische-context-onderzoeks-
// gebied.md, "Beslissingen" nr. 6): dit triggert een dure, 15+ seconden
// kostende scan over 112.184 instanties, niet de sub-seconde van de andere
// lazy-detailroutes - een aantrekkelijkere misbruikvector.
const rateLimiter = createRateLimiter(8);

export async function GET(request: Request) {
  return withRceErrorHandling({ event: "rce.archeologische-context.error" }, async (startedAt) => {
    const url = new URL(request.url);
    const monumentNumber = url.searchParams.get("rijksmonumentnummer") ?? "";
    if (!MONUMENT_NUMBER_PATTERN.test(monumentNumber)) {
      return Response.json({ error: "Ongeldig rijksmonumentnummer." }, { status: 400 });
    }

    // Cachen vóór de rate-limit-check: een al berekend antwoord opnieuw
    // serveren kost niets en moet niet meetellen tegen het budget van deze
    // dure route (017-archeologische-context-onderzoeksgebied.md,
    // "Beslissingen" nr. 2).
    const cacheKey = new Request(`${url.origin}/api/rce/archeologische-context?rijksmonumentnummer=${monumentNumber}`);
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const gebieden = await fetchArcheologischeContext(monumentNumber, request.signal);
    const response = new Response(JSON.stringify({ gebieden }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": sharedCacheControl(CACHE_POLICY.archeologischeContext),
        "Server-Timing": `rce;dur=${Date.now() - startedAt}`,
      },
    });
    await writeCache(cacheKey, response.clone());
    console.info(JSON.stringify({ event: "rce.archeologische-context", durationMs: Date.now() - startedAt, gebiedenCount: gebieden.length }));
    return response;
  });
}
