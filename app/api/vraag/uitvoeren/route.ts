import { executeVraagQuery } from "../../../../lib/server/vraag-adapter.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";
import { SpatialFallbackIncompleteError } from "../../../../lib/vraag/spatial-fallback.ts";

export const runtime = "edge";

// Zelfde budget als genereer-sparql: een bezoeker kan hier ook los een
// (bewerkte) query indienen zonder eerst genereer-sparql aan te roepen, dus
// dit moet onafhankelijk beperkt zijn.
const rateLimiter = createRateLimiter(5);
const MAX_QUERY_LENGTH = 20_000;

export async function POST(request: Request) {
  return withRceErrorHandling({ event: "vraag.uitvoeren.error" }, async (startedAt) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ongeldig verzoek." }, { status: 400 });
    }
    const { query } = body as { query?: unknown };
    if (typeof query !== "string" || query.trim().length === 0 || query.length > MAX_QUERY_LENGTH) {
      return Response.json({ error: "Ongeldige of te lange SPARQL-query." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    let results;
    try {
      results = await executeVraagQuery(query, request.signal);
    } catch (error) {
      // Eigen, eerlijke melding i.p.v. withRceErrorHandling's generieke
      // "niet bereikbaar" - dit is geen storing maar een te brede
      // ruimtelijke vraag (zie lib/vraag/spatial-fallback.ts).
      if (error instanceof SpatialFallbackIncompleteError) {
        return Response.json({ error: error.message }, { status: 422, headers: { "Cache-Control": NO_STORE } });
      }
      throw error;
    }
    return Response.json({ results }, { headers: { "Cache-Control": NO_STORE, "Server-Timing": `vraag;dur=${Date.now() - startedAt}` } });
  });
}
