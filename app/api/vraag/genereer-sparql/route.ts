import { generateSparqlQuery } from "../../../../lib/server/vraag-adapter.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";

export const runtime = "edge";

// Elke vraag kost een echte Anthropic-aanroep (geld), in tegenstelling tot
// de gratis /api/rce/*-routes - een substantieel strenger budget dan de
// gebruikelijke 30/min.
const rateLimiter = createRateLimiter(5);

export async function POST(request: Request) {
  return withRceErrorHandling({ event: "vraag.genereer-sparql.error", message: "De vraag-assistent is momenteel niet bereikbaar." }, async (startedAt) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ongeldig verzoek." }, { status: 400 });
    }
    const { question, mode } = body as { question?: unknown; mode?: unknown };
    if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
      return Response.json({ error: "Stel een vraag van 3 tot 300 tekens." }, { status: 400 });
    }
    if (mode !== "lijst" && mode !== "telling") {
      return Response.json({ error: "Ongeldige modus." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const query = await generateSparqlQuery(question.trim(), mode, request.signal);
    return Response.json({ query }, { headers: { "Cache-Control": NO_STORE, "Server-Timing": `vraag;dur=${Date.now() - startedAt}` } });
  });
}
