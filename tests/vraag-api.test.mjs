import assert from "node:assert/strict";
import test from "node:test";
import { POST as genereerSparql } from "../app/api/vraag/genereer-sparql/route.ts";
import { POST as uitvoeren } from "../app/api/vraag/uitvoeren/route.ts";
import { POST as antwoord } from "../app/api/vraag/antwoord/route.ts";

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

function anthropicResponse(text) {
  return Response.json({ content: [{ type: "text", text }] });
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
