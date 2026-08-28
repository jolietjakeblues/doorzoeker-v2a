import { generateAntwoord } from "../../../../lib/server/vraag-adapter.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";
import type { SparqlResultsDocument } from "../../../../lib/vraag/postprocess.ts";

export const runtime = "edge";

const rateLimiter = createRateLimiter(5);
const MAX_RESULTS_JSON_LENGTH = 200_000;

function isSparqlResultsDocument(value: unknown): value is SparqlResultsDocument {
  return typeof value === "object" && value !== null && "results" in value;
}

export async function POST(request: Request) {
  return withRceErrorHandling({ event: "vraag.antwoord.error", message: "De vraag-assistent is momenteel niet bereikbaar." }, async (startedAt) => {
    let body: unknown;
    let rawBody = "";
    try {
      rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Ongeldig verzoek." }, { status: 400 });
    }
    const { question, results } = body as { question?: unknown; results?: unknown };
    if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
      return Response.json({ error: "Ongeldige vraag." }, { status: 400 });
    }
    if (!isSparqlResultsDocument(results) || rawBody.length > MAX_RESULTS_JSON_LENGTH) {
      return Response.json({ error: "Ongeldige of te grote resultatenset." }, { status: 400 });
    }
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    const answer = await generateAntwoord(question.trim(), results, request.signal);
    return Response.json({ answer }, { headers: { "Cache-Control": NO_STORE, "Server-Timing": `vraag;dur=${Date.now() - startedAt}` } });
  });
}
