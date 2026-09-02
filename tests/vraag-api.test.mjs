import assert from "node:assert/strict";
import test from "node:test";
import { POST as genereerSparql } from "../app/api/vraag/genereer-sparql/route.ts";
import { POST as uitvoeren } from "../app/api/vraag/uitvoeren/route.ts";
import { POST as antwoord } from "../app/api/vraag/antwoord/route.ts";
import { FALLBACK_CANDIDATE_LIMIT } from "../lib/vraag/spatial-fallback.ts";

function withMocks(context, { fetchImpl }) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-sleutel";
  globalThis.fetch = fetchImpl;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });
}

function anthropicResponse(text, stopReason = "end_turn") {
  return Response.json({ content: [{ type: "text", text }], stop_reason: stopReason });
}

function jsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "test-vraag" },
    body: JSON.stringify(body),
  });
}

test("genereer-sparql: geeft een nabewerkte query terug op basis van het Anthropic-antwoord", async (context) => {
  withMocks(context, {
    fetchImpl: async (input) => {
      assert.match(String(input), /api\.anthropic\.com/);
      return anthropicResponse("```sparql\nSELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:rijksmonumentnummer ?nummer . }\n```");
    },
  });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.doesNotMatch(document.query, /```/);
  assert.match(document.query, /PREFIX ceo:/);
  assert.match(document.query, /LIMIT 200/);
});

test("genereer-sparql: herkanst één keer als de lijstmodus toch een COUNT oplevert", async (context) => {
  let calls = 0;
  withMocks(context, {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return anthropicResponse("SELECT (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a ceo:Rijksmonument }");
      return anthropicResponse("SELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:rijksmonumentnummer ?nummer . }");
    },
  });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.doesNotMatch(document.query, /COUNT/i);
  assert.equal(calls, 2);
});

test("genereer-sparql: herkanst één keer met de gevonden fouten als de semantische volledigheidscheck faalt (bv. 'kerken' zonder functiepad)", async (context) => {
  let calls = 0;
  let secondBody;
  withMocks(context, {
    fetchImpl: async (input, init) => {
      calls += 1;
      if (calls === 1) return anthropicResponse("SELECT DISTINCT ?rm WHERE { ?rm a ceo:Rijksmonument }");
      secondBody = JSON.parse(String(init.body));
      return anthropicResponse("SELECT DISTINCT ?rm WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:heeftOorspronkelijkeFunctie ?f }");
    },
  });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke kerken staan er in Zeist?", mode: "lijst" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(document.query, /heeftOorspronkelijkeFunctie/);
  assert.equal(calls, 2);
  assert.match(secondBody.messages[0].content, /CORRIGEER DE VORIGE QUERY/);
  assert.match(secondBody.messages[0].content, /functie of type/);
});

test("genereer-sparql: herkanst met meer budget als het antwoord is afgekapt (max_tokens)", async (context) => {
  let calls = 0;
  let secondCallMaxTokens;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      calls += 1;
      if (calls === 1) {
        // Live geconstateerd (28-08-2026): een afgekapte respons mist hele
        // UNION-takken en sluithaken - niet iets wat postprocessing kan
        // repareren, dus deze mag nooit als `query` teruggegeven worden.
        return anthropicResponse('SELECT DISTINCT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(CONTAINS(LCASE(?fNaam), "kerk"', "max_tokens");
      }
      secondCallMaxTokens = JSON.parse(init.body).max_tokens;
      return anthropicResponse("SELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:rijksmonumentnummer ?nummer . }");
    },
  });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.doesNotMatch(document.query, /CONTAINS\(LCASE\(\?fNaam\), "kerk"$/m);
  assert.equal(calls, 2);
  assert.ok(secondCallMaxTokens > 2000, "de herkansing moet met een hoger max_tokens-budget aanroepen");
});

test("genereer-sparql: valt terug op een aanroep zonder MCP-tools als de rce-cho-server onbereikbaar is", async (context) => {
  let calls = 0;
  const bodies = [];
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      calls += 1;
      bodies.push(JSON.parse(init.body));
      if (calls === 1) {
        // Live geconstateerd (28-08-2026): een onbereikbare MCP-server laat
        // de HELE Anthropic-aanroep mislukken met HTTP 400, niet een
        // gedeeltelijke degradatie - vandaar de terugval zonder mcp_servers.
        return new Response(
          JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Connection error while communicating with MCP server. The server may be unavailable or unresponsive." } }),
          { status: 400 },
        );
      }
      return anthropicResponse("SELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:rijksmonumentnummer ?nummer . }");
    },
  });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(document.query, /PREFIX ceo:/);
  assert.equal(calls, 2);
  assert.ok(bodies[0].mcp_servers?.length, "eerste poging moet mcp_servers meesturen");
  assert.equal(bodies[1].mcp_servers, undefined, "terugvalpoging mag geen mcp_servers meesturen");
});

test("genereer-sparql: 400 bij een te korte vraag", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "hi", mode: "lijst" }));
  assert.equal(response.status, 400);
});

test("genereer-sparql: 400 bij een ongeldige modus", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await genereerSparql(jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "grafiek" }));
  assert.equal(response.status, 400);
});

test("uitvoeren: voert de query uit tegen het RCE-endpoint en dedupliceert op ?rm", async (context) => {
  withMocks(context, {
    fetchImpl: async (input) => {
      assert.match(String(input), /linkeddata\.cultureelerfgoed\.nl/);
      return Response.json({
        head: { vars: ["rm", "naam"] },
        results: {
          bindings: [
            { rm: { type: "uri", value: "https://example.org/rm/1" }, naam: { type: "literal", value: "Eerste" } },
            { rm: { type: "uri", value: "https://example.org/rm/1" }, naam: { type: "literal", value: "Dubbele naaminstantie" } },
          ],
        },
      });
    },
  });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "SELECT DISTINCT ?rm ?naam WHERE { ?rm a ceo:Rijksmonument }" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results.results.bindings.length, 1);
});

test("uitvoeren: valt terug op een lokale ruimtelijke berekening als geof:sfWithin op RCE een TopologyException geeft", async (context) => {
  let calls = 0;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      calls += 1;
      const body = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      if (body.includes("geof:sfWithin")) {
        return new Response(JSON.stringify({ message: "Virtuoso 22023 Error GEO22: TopologyException: side location conflict" }), { status: 500 });
      }
      // De vereenvoudigde query (zonder ruimtelijke FILTER) - een klein
      // aantal kandidaten, ruim onder FALLBACK_CANDIDATE_LIMIT.
      return Response.json({
        head: { vars: ["rm", "rmWkt", "gezichtWkt"] },
        results: {
          bindings: [
            { rm: { type: "uri", value: "https://example.org/rm/1" }, rmWkt: { type: "literal", value: "POINT(5 5)" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
            { rm: { type: "uri", value: "https://example.org/rm/2" }, rmWkt: { type: "literal", value: "POINT(50 50)" }, gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" } },
          ],
        },
      });
    },
  });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) }" }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results.results.bindings.length, 1);
  assert.equal(document.results.results.bindings[0].rm.value, "https://example.org/rm/1");
  assert.ok(calls > 1);
});

test("uitvoeren: 422 met een eerlijke melding als de terugvalquery het verruimde plafond raakt (mogelijk vals-negatief)", async (context) => {
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      const body = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      if (body.includes("geof:sfWithin")) {
        return new Response(JSON.stringify({ message: "TopologyException" }), { status: 500 });
      }
      // Live geconstateerd (28-08-2026, "rijksmonumenten binnen Gezicht
      // Schil Dordrecht" zonder gemeente-/functiefilter): het verruimde
      // plafond geraakt betekent dat er mogelijk kandidaten buiten de set
      // vielen - dan hoort Doorzoeker niet zomaar 0 (of een ander getal)
      // als definitief antwoord te presenteren.
      const bindings = Array.from({ length: FALLBACK_CANDIDATE_LIMIT }, (_, i) => ({ rm: { type: "uri", value: `https://example.org/rm/${i}` } }));
      return Response.json({ head: { vars: ["rm"] }, results: { bindings } });
    },
  });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "SELECT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) }" }));
  assert.equal(response.status, 422);
  const document = await response.json();
  assert.match(document.error, /specifieker/);
});

test("uitvoeren: 400 bij een lege query", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "  " }));
  assert.equal(response.status, 400);
});

test("antwoord: geeft het Anthropic-antwoord terug", async (context) => {
  withMocks(context, {
    fetchImpl: async (input) => {
      assert.match(String(input), /api\.anthropic\.com/);
      return anthropicResponse("In Zeist staan verschillende rijksmonumenten, waaronder een aantal kerken en landhuizen.");
    },
  });
  const results = { head: { vars: ["rm"] }, results: { bindings: [{ rm: { type: "uri", value: "https://example.org/rm/1" } }] } };
  const response = await antwoord(jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Welke rijksmonumenten staan er in Zeist?", results }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(document.answer, /Zeist/);
});

test("antwoord: 400 bij ontbrekende resultaten", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await antwoord(jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Welke rijksmonumenten staan er in Zeist?" }));
  assert.equal(response.status, 400);
});
