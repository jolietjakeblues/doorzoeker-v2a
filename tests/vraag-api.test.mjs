import assert from "node:assert/strict";
import test from "node:test";
import { POST as genereerSparql } from "../app/api/vraag/genereer-sparql/route.ts";
import { POST as uitvoeren } from "../app/api/vraag/uitvoeren/route.ts";
import { POST as antwoord } from "../app/api/vraag/antwoord/route.ts";
import { FALLBACK_CANDIDATE_LIMIT } from "../lib/vraag/spatial-fallback.ts";
import { __resetResolverCacheForTests } from "../lib/vraag/semantic-resolver.ts";

function isSparqlEndpoint(input) {
  return /linkeddata\.cultureelerfgoed\.nl/.test(String(input));
}

function extractSparqlQueryText(input, init) {
  if (init?.body) return decodeURIComponent(String(init.body).replace(/^query=/, ""));
  try {
    return decodeURIComponent(new URL(String(input)).searchParams.get("query") ?? "");
  } catch {
    return "";
  }
}

// lib/vraag/semantic-resolver.ts vraagt vóór elke Anthropic-aanroep drie
// OWMS/woonplaats-SPARQL-query's op (via fetchSparql, GET, dus als
// querystring). Herkend op query-inhoud (graph:owms / ceo:woonplaatsnaam),
// niet op host - de "uitvoeren"-tests praten tegen hetzelfde RCE-endpoint
// met een andere (uitvoerings-)query en moeten dit pad niet raken.
function isResolverQuery(input, init) {
  const queryText = extractSparqlQueryText(input, init);
  return queryText.includes("graph:owms") || queryText.includes("ceo:woonplaatsnaam");
}

function emptySparqlResultsResponse() {
  return Response.json({ head: { vars: [] }, results: { bindings: [] } });
}

function owmsBindingResponse(uri, label) {
  return Response.json({ head: { vars: ["uri", "label"] }, results: { bindings: [{ uri: { type: "uri", value: uri }, label: { type: "literal", value: label } }] } });
}

// Standaard beantwoordt withMocks de resolutielaag se drie OWMS/woonplaats-
// query's leeg, zodat bestaande tests die niets met resolutie te maken
// hebben ongewijzigd blijven werken (geen ambiguïteit, geen beperking,
// gewoon door naar de Anthropic-aanroep). Geef `resolverImpl` mee om dat
// voor een specifieke test te overschrijven (bv. om een echte
// gemeente/provincie-naamsbotsing te simuleren).
function withMocks(context, { fetchImpl, resolverImpl }) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-sleutel";
  // De resolutielaag cachet OWMS/woonplaats-termen module-scope (zie
  // lib/vraag/semantic-resolver.ts) - zonder reset zou een eerdere test in
  // dit bestand haar (lege) mockrespons laten "lekken" naar deze test.
  __resetResolverCacheForTests();
  globalThis.fetch = async (input, init) => {
    if (isSparqlEndpoint(input) && isResolverQuery(input, init)) {
      return resolverImpl ? resolverImpl(input, init) : emptySparqlResultsResponse();
    }
    return fetchImpl(input, init);
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    __resetResolverCacheForTests();
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });
}

function anthropicResponse(text, stopReason = "end_turn") {
  return Response.json({ content: [{ type: "text", text }], stop_reason: stopReason });
}

function jsonRequest(url, body, ip = "test-vraag") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
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

test("genereer-sparql: 422 met een eerlijke melding als de query na de correctiepoging nog steeds syntactisch ongeldig is", async (context) => {
  let calls = 0;
  withMocks(context, {
    fetchImpl: async () => {
      calls += 1;
      // Een dubbele vergelijkingsoperator -- geen van postprocess.ts's
      // fixes (prefixes, gemeente-/provinciepad, label-filter,
      // balanceBraces, capListLimit) raakt hieraan, dus blijft na de
      // herkansing net zo ongeldig als ervoor.
      return anthropicResponse(
        'SELECT ?rm ?jaar WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:registratiedatum ?jaar . FILTER(?jaar > > "2000-01-01"^^xsd:date) }',
      );
    },
  });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Zeist?", mode: "lijst" }, "test-vraag-syntax-invalid"),
  );
  assert.equal(response.status, 422);
  const document = await response.json();
  assert.match(document.error, /geen geldige SPARQL-query/);
  assert.equal(calls, 2, "moet één correctiepoging doen voordat de fout wordt teruggegeven");
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

test("genereer-sparql: geeft een verduidelijkingsvraag terug bij een echte gemeente/provincie-naamsbotsing, zonder Anthropic aan te roepen", async (context) => {
  withMocks(context, {
    resolverImpl: async (input, init) => {
      const queryText = extractSparqlQueryText(input, init);
      if (queryText.includes("ceo:woonplaatsnaam")) return emptySparqlResultsResponse();
      if (queryText.includes("/terms/Gemeente>")) return owmsBindingResponse("http://standaarden.overheid.nl/owms/terms/Groningen_(gemeente)", "Groningen");
      return owmsBindingResponse("http://standaarden.overheid.nl/owms/terms/Groningen_(provincie)", "Groningen");
    },
    fetchImpl: async () => { throw new Error("Anthropic had niet aangeroepen mogen worden bij een onopgeloste ambiguïteit"); },
  });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten staan er in Groningen?", mode: "lijst" }, "test-vraag-ambigu-1"),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.clarification.type, "entity_ambiguity");
  assert.match(document.clarification.message, /Groningen/);
  assert.equal(document.clarification.options.length, 2);
});

test("genereer-sparql: gaat door met de gekozen kant na een disambiguation-keuze", async (context) => {
  let secondBody;
  withMocks(context, {
    resolverImpl: async (input, init) => {
      const queryText = extractSparqlQueryText(input, init);
      if (queryText.includes("ceo:woonplaatsnaam")) return emptySparqlResultsResponse();
      if (queryText.includes("/terms/Gemeente>")) return owmsBindingResponse("http://standaarden.overheid.nl/owms/terms/Groningen_(gemeente)", "Groningen");
      return owmsBindingResponse("http://standaarden.overheid.nl/owms/terms/Groningen_(provincie)", "Groningen");
    },
    fetchImpl: async (_input, init) => {
      secondBody = JSON.parse(init.body);
      return anthropicResponse("SELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:rijksmonumentnummer ?nummer . }");
    },
  });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", {
      question: "Welke rijksmonumenten staan er in Groningen?",
      mode: "lijst",
      disambiguation: { Groningen: "provincie" },
    }, "test-vraag-ambigu-2"),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(document.query, /PREFIX ceo:/);
  assert.match(secondBody.messages[0].content, /OPGELOSTE BEGRIPPEN/);
  assert.match(secondBody.messages[0].content, /provincie "Groningen" = <http:\/\/standaarden\.overheid\.nl\/owms\/terms\/Groningen_\(provincie\)>/);
});

test("genereer-sparql: geeft een verduidelijkingsvraag terug bij een begraafplaats-nabijheidsvraag, zonder Anthropic aan te roepen", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("Anthropic had niet aangeroepen mogen worden zonder gekozen deelinterpretatie"); } });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Welke rijksmonumenten liggen bij een begraafplaats?", mode: "lijst" }, "test-vraag-beperking-1"),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.clarification.type, "answerability_limitation");
  assert.equal(document.clarification.options.length, 2);
});

test("genereer-sparql: gaat door met de gekozen deelinterpretatie na een limitationChoice, en geeft de caveat mee terug", async (context) => {
  let secondBody;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      secondBody = JSON.parse(init.body);
      return anthropicResponse("SELECT DISTINCT ?rm ?nummer WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:heeftOorspronkelijkeFunctie ?f . ?rm ceo:rijksmonumentnummer ?nummer . }");
    },
  });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", {
      question: "Welke rijksmonumenten liggen bij een begraafplaats?",
      mode: "lijst",
      limitationChoice: "functie_begraafplaats",
    }, "test-vraag-beperking-2"),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.match(secondBody.messages[0].content, /begraafplaats-variant is/);
  assert.equal(document.caveats.length, 1);
  assert.match(document.caveats[0], /niet losse grafmonumenten/);
});

test("genereer-sparql: geeft een transparantiekanttekening terug bij een vage 'soort/aard/type'-vraag", async (context) => {
  withMocks(context, {
    fetchImpl: async () => anthropicResponse("SELECT DISTINCT ?rm ?aard WHERE { ?rm a ceo:Rijksmonument . ?rm ceo:heeftMonumentAard ?aardC . ?aardC skos:prefLabel ?aard }"),
  });
  const response = await genereerSparql(
    jsonRequest("https://doorzoeker.test/api/vraag/genereer-sparql", { question: "Wat voor soort monument is dit?", mode: "lijst" }, "test-vraag-vage-soort"),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.caveats.length, 1);
  assert.match(document.caveats[0], /monumentaard \(uitsluitend archeologisch\/onroerend gebouwd\)/);
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
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT DISTINCT ?rm ?naam WHERE { ?rm a ceo:Rijksmonument }" }));
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
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nPREFIX geof: <http://www.opengis.net/def/function/geosparql/>\nSELECT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) }" }));
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
      const bindings = Array.from({ length: FALLBACK_CANDIDATE_LIMIT }, (_, i) => ({
        rm: { type: "uri", value: `https://example.org/rm/${i}` },
        rmWkt: { type: "literal", value: "POINT(5 5)" },
        gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" },
      }));
      return Response.json({ head: { vars: ["rm", "rmWkt", "gezichtWkt"] }, results: { bindings } });
    },
  });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nPREFIX geof: <http://www.opengis.net/def/function/geosparql/>\nSELECT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) }" }));
  assert.equal(response.status, 422);
  const document = await response.json();
  assert.match(document.error, /specifieker/);
});

test("uitvoeren: 400 bij een lege query", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "  " }));
  assert.equal(response.status, 400);
});

test("uitvoeren: 400 bij een SERVICE-federatie naar een extern endpoint (securityreview 15-09-2026)", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden - dit hoort geweigerd te worden vóór enige RCE-aanroep"); } });
  const response = await uitvoeren(
    jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "SELECT ?s WHERE { SERVICE <https://example.invalid/sparql> { ?s ?p ?o } }" }),
  );
  assert.equal(response.status, 400);
});

test("uitvoeren: 400 bij een niet-SELECT-query (ASK/CONSTRUCT/DESCRIBE)", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await uitvoeren(jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "ASK { ?s ?p ?o }" }));
  assert.equal(response.status, 400);
});

test("uitvoeren: dwingt een buitenste LIMIT af, ook als de ingediende query er zelf geen heeft (securityreview 15-09-2026)", async (context) => {
  let sentQuery;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      sentQuery = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      return Response.json({ head: { vars: ["s"] }, results: { bindings: [] } });
    },
  });
  const response = await uitvoeren(
    jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", { query: "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT ?s WHERE { ?s a ceo:Rijksmonument }" }),
  );
  assert.equal(response.status, 200);
  assert.match(sentQuery, /LIMIT 200\s*$/);
});

test("uitvoeren: accepteert een buitenste LIMIT met een afsluitende OFFSET zonder een dubbele LIMIT te produceren (hercontrole 15-09-2026)", async (context) => {
  let sentQuery;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      sentQuery = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      return Response.json({ head: { vars: ["s"] }, results: { bindings: [] } });
    },
  });
  const response = await uitvoeren(
    jsonRequest(
      "https://doorzoeker.test/api/vraag/uitvoeren",
      { query: "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nSELECT ?s WHERE { ?s a ceo:Rijksmonument } LIMIT 500 OFFSET 10" },
      "test-vraag-hercontrole-offset",
    ),
  );
  assert.equal(response.status, 200);
  assert.match(sentQuery, /LIMIT 200 OFFSET 10/);
  assert.equal((sentQuery.match(/LIMIT/gi) ?? []).length, 1);
});

test("uitvoeren: 400 bij SERVICE genest in FILTER EXISTS (hercontrole 15-09-2026)", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await uitvoeren(
    jsonRequest("https://doorzoeker.test/api/vraag/uitvoeren", {
      query: "SELECT ?s WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <https://example.invalid/sparql> { ?a ?b ?c } } }",
    }),
  );
  assert.equal(response.status, 400);
});

test("uitvoeren: ruimtelijke terugval op een telling herstelt de echte COUNT i.p.v. 200 losse detailrijen (hercontrole 15-09-2026)", async (context) => {
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      const body = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      if (body.includes("geof:sfWithin")) {
        return new Response(JSON.stringify({ message: "TopologyException" }), { status: 500 });
      }
      // 250 kandidaten, allemaal daadwerkelijk binnen het gebied - ruim
      // onder FALLBACK_CANDIDATE_LIMIT, dus geen "plafond geraakt"-fout.
      const bindings = Array.from({ length: 250 }, (_, i) => ({
        rm: { type: "uri", value: `https://example.org/rm/${i}` },
        rmWkt: { type: "literal", value: "POINT(5 5)" },
        gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" },
      }));
      return Response.json({ head: { vars: ["rm", "rmWkt", "gezichtWkt"] }, results: { bindings } });
    },
  });
  const response = await uitvoeren(
    jsonRequest(
      "https://doorzoeker.test/api/vraag/uitvoeren",
      {
        query:
          "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nPREFIX geof: <http://www.opengis.net/def/function/geosparql/>\nSELECT (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) }",
      },
      "test-vraag-hercontrole-count-fallback",
    ),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.deepEqual(document.results.head.vars, ["aantal"]);
  assert.equal(document.results.results.bindings.length, 1);
  assert.equal(document.results.results.bindings[0].aantal.value, "250");
});

test("uitvoeren: ruimtelijke terugval op een lijstquery met LIMIT 5 geeft ten hoogste 5 rijen met alleen de oorspronkelijke kolommen (hercontrole 15-09-2026)", async (context) => {
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      const body = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      if (body.includes("geof:sfWithin")) {
        return new Response(JSON.stringify({ message: "TopologyException" }), { status: 500 });
      }
      const bindings = Array.from({ length: 20 }, (_, i) => ({
        rm: { type: "uri", value: `https://example.org/rm/${i}` },
        rmWkt: { type: "literal", value: "POINT(5 5)" },
        gezichtWkt: { type: "literal", value: "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))" },
      }));
      return Response.json({ head: { vars: ["rm", "rmWkt", "gezichtWkt"] }, results: { bindings } });
    },
  });
  const response = await uitvoeren(
    jsonRequest(
      "https://doorzoeker.test/api/vraag/uitvoeren",
      {
        query:
          "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nPREFIX geof: <http://www.opengis.net/def/function/geosparql/>\nSELECT ?rm WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) } LIMIT 5",
      },
      "test-vraag-hercontrole-list-fallback",
    ),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.deepEqual(document.results.head.vars, ["rm"]);
  assert.equal(document.results.results.bindings.length, 5);
  for (const row of document.results.results.bindings) {
    assert.deepEqual(Object.keys(row), ["rm"]);
  }
});

test("uitvoeren: ruimtelijke terugval op een GEGROEPEERDE telling geeft een eerlijke fout i.p.v. een stilzwijgend fout resultaat (hercontrole 15-09-2026)", async (context) => {
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      const body = decodeURIComponent(String(init?.body ?? "").replace(/^query=/, ""));
      if (body.includes("geof:sfWithin")) {
        return new Response(JSON.stringify({ message: "TopologyException" }), { status: 500 });
      }
      throw new Error("de vereenvoudigde terugvalquery had niet uitgevoerd mogen worden voor een niet-herstelbare vorm");
    },
  });
  const response = await uitvoeren(
    jsonRequest(
      "https://doorzoeker.test/api/vraag/uitvoeren",
      {
        query:
          "PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>\nPREFIX geof: <http://www.opengis.net/def/function/geosparql/>\nSELECT ?gemeente (COUNT(DISTINCT ?rm) AS ?aantal) WHERE { ?rm a ceo:Rijksmonument . FILTER(geof:sfWithin(?rmWkt, ?gezichtWkt)) } GROUP BY ?gemeente",
      },
      "test-vraag-hercontrole-group-fallback",
    ),
  );
  assert.equal(response.status, 422);
  const document = await response.json();
  assert.match(document.error, /niet betrouwbaar/);
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

test("antwoord: voegt meegegeven kanttekeningen als 'Let op: ...'-alinea's toe ná het Anthropic-antwoord", async (context) => {
  withMocks(context, {
    fetchImpl: async () => anthropicResponse("In Zeist staan verschillende rijksmonumenten."),
  });
  const results = { head: { vars: ["rm"] }, results: { bindings: [{ rm: { type: "uri", value: "https://example.org/rm/1" } }] } };
  const response = await antwoord(
    jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Welke rijksmonumenten staan er in Zeist?", results, caveats: ["Voorbeeldkanttekening."] }),
  );
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.answer, "In Zeist staan verschillende rijksmonumenten.\n\nLet op: Voorbeeldkanttekening.");
});

test("antwoord: bij een telling met één 'aantal'-rij krijgt de prompt de echte waarde, niet het aantal rijen (securityreview 15-09-2026)", async (context) => {
  let sentPrompt;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      sentPrompt = JSON.parse(init.body).messages[0].content;
      return anthropicResponse("Er staan 42 kerken in Utrecht.");
    },
  });
  const results = { head: { vars: ["aantal"] }, results: { bindings: [{ aantal: { type: "literal", value: "42" } }] } };
  const response = await antwoord(
    jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Hoeveel kerken zijn er in Utrecht?", results, mode: "telling" }),
  );
  assert.equal(response.status, 200);
  assert.doesNotMatch(sentPrompt, /totaal \(1\)/, "de prompt mag niet het aantal RIJEN (1) als totaal presenteren");
  assert.match(sentPrompt, /kolom "aantal"/);
});

test("antwoord: bij een gegroepeerde telling claimt de prompt niet het aantal groepen als totaal", async (context) => {
  let sentPrompt;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      sentPrompt = JSON.parse(init.body).messages[0].content;
      return anthropicResponse("De meeste rijksmonumenten staan in Noord-Holland.");
    },
  });
  const results = {
    head: { vars: ["provincie", "aantal"] },
    results: {
      bindings: [
        { provincie: { type: "literal", value: "Noord-Holland" }, aantal: { type: "literal", value: "9000" } },
        { provincie: { type: "literal", value: "Zeeland" }, aantal: { type: "literal", value: "3000" } },
      ],
    },
  };
  const response = await antwoord(
    jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Hoeveel rijksmonumenten per provincie?", results, mode: "telling" }),
  );
  assert.equal(response.status, 200);
  assert.match(sentPrompt, /GEGROEPEERDE telling/);
  assert.match(sentPrompt, /NIET.*totale aantal/);
});

test("antwoord: bij lijst-modus blijft het bestaande gedrag (rijaantal als totaal) ongewijzigd", async (context) => {
  let sentPrompt;
  withMocks(context, {
    fetchImpl: async (_input, init) => {
      sentPrompt = JSON.parse(init.body).messages[0].content;
      return anthropicResponse("In Zeist staan verschillende rijksmonumenten.");
    },
  });
  const results = { head: { vars: ["rm"] }, results: { bindings: [{ rm: { type: "uri", value: "https://example.org/rm/1" } }] } };
  const response = await antwoord(
    jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Welke rijksmonumenten staan er in Zeist?", results, mode: "lijst" }),
  );
  assert.equal(response.status, 200);
  assert.doesNotMatch(sentPrompt, /GEGROEPEERDE telling/);
});

test("antwoord: 400 bij ontbrekende resultaten", async (context) => {
  withMocks(context, { fetchImpl: async () => { throw new Error("fetch had niet aangeroepen mogen worden"); } });
  const response = await antwoord(jsonRequest("https://doorzoeker.test/api/vraag/antwoord", { question: "Welke rijksmonumenten staan er in Zeist?" }));
  assert.equal(response.status, 400);
});
