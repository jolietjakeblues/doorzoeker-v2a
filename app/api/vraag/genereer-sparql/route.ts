import { generateSparqlQuery } from "../../../../lib/server/vraag-adapter.ts";
import { createRateLimiter, rateLimitedResponse } from "../../../../lib/server/route-rate-limit.ts";
import { withRceErrorHandling } from "../../../../lib/server/route-error-handling.ts";
import { NO_STORE } from "../../../../lib/server/http-cache.ts";
import { SparqlSyntaxInvalidError } from "../../../../lib/vraag/syntax-validator.ts";
import { UnsafeSparqlError } from "../../../../lib/vraag/query-guard.ts";

export const runtime = "edge";

// Elke vraag kost een echte Anthropic-aanroep (geld), in tegenstelling tot
// de gratis /api/rce/*-routes - een substantieel strenger budget dan de
// gebruikelijke 30/min.
const rateLimiter = createRateLimiter(5);

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === "string");
}

export async function POST(request: Request) {
  return withRceErrorHandling({ event: "vraag.genereer-sparql.error", message: "De vraag-assistent is momenteel niet bereikbaar." }, async (startedAt) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ongeldig verzoek." }, { status: 400 });
    }
    const { question, mode, disambiguation, limitationChoice } = body as { question?: unknown; mode?: unknown; disambiguation?: unknown; limitationChoice?: unknown };
    if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
      return Response.json({ error: "Stel een vraag van 3 tot 300 tekens." }, { status: 400 });
    }
    if (mode !== "lijst" && mode !== "telling") {
      return Response.json({ error: "Ongeldige modus." }, { status: 400 });
    }
    const parsedDisambiguation = isStringRecord(disambiguation) ? disambiguation : undefined;
    const parsedLimitationChoice = typeof limitationChoice === "string" && limitationChoice.length > 0 ? limitationChoice : undefined;
    if (!rateLimiter.consume(request)) return rateLimitedResponse();

    let result;
    try {
      result = await generateSparqlQuery(question.trim(), mode, request.signal, { disambiguation: parsedDisambiguation, limitationChoice: parsedLimitationChoice });
    } catch (error) {
      // Eigen, eerlijke melding i.p.v. withRceErrorHandling's generieke
      // "niet bereikbaar" - dit is geen storing maar een vraag waarvoor
      // ook na de correctiepoging geen geldige SPARQL is gelukt (zie
      // lib/vraag/syntax-validator.ts).
      if (error instanceof SparqlSyntaxInvalidError) {
        return Response.json(
          { error: "Kon voor deze vraag geen geldige SPARQL-query genereren. Probeer de vraag anders te formuleren." },
          { status: 422, headers: { "Cache-Control": NO_STORE } },
        );
      }
      // Structurele veiligheidsafwijzing (lib/vraag/query-guard.ts) - zeldzaam
      // op dit pad (de kennisbank vraagt Claude nooit om SERVICE/FROM), maar
      // zelfde eerlijke 422 i.p.v. de generieke 502 als het toch voorkomt.
      if (error instanceof UnsafeSparqlError) {
        return Response.json(
          { error: "Kon voor deze vraag geen geldige SPARQL-query genereren. Probeer de vraag anders te formuleren." },
          { status: 422, headers: { "Cache-Control": NO_STORE } },
        );
      }
      throw error;
    }
    // Een verduidelijkingsvraag is geen fout maar een verwachte "meer input
    // nodig"-uitkomst (echte gemeente/provincie-naamsbotsing, of een vraag
    // zonder eenduidige SPARQL-vertaling) - gewoon 200, matcht chat2thedata's
    // app.py-gedrag. De browser POST't hierna opnieuw met de gekozen
    // disambiguation/limitationChoice.
    if (result.status === "clarification") {
      return Response.json({ clarification: result.clarification }, { headers: { "Cache-Control": NO_STORE } });
    }
    return Response.json(
      { query: result.query, caveats: result.caveats },
      { headers: { "Cache-Control": NO_STORE, "Server-Timing": `vraag;dur=${Date.now() - startedAt}` } },
    );
  });
}
