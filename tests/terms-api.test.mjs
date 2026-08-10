import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/terms/suggest/route.ts";

test("returns no suggestions for one character without an upstream call", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=w"));
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: false });
});

test("queries CHT, Referentienetwerk 2 and ABR directly via SPARQL and merges suggestions", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("cht")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/cht/1" }, label: { value: "Woonhuis" }, isMateriaal: { value: "false" }, isStijlPeriode: { value: "false" } },
      ] } });
    }
    if (url.includes("datasets/thesauri/referentienetwerk")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/1" }, label: { value: "Woonhuiscategorie" }, scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/schema" }, schemeLabel: { value: "Monumenten Registratie Systeem" } },
      ] } });
    }
    return Response.json({ results: { bindings: [
      { concept: { value: "https://data.cultureelerfgoed.nl/term/id/abr/1" }, label: { value: "woonhuisaardewerk" } },
    ] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=woon", { headers: { "cf-connecting-ip": "terms-success" } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.suggestions, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/cht/1", label: "Woonhuis", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus", sourceName: "Cultuurhistorische Thesaurus" },
    { uri: "https://data.cultureelerfgoed.nl/term/id/abr/1", label: "woonhuisaardewerk", sourceUri: "https://data.cultureelerfgoed.nl/term/id/abr/thesaurus", sourceName: "Archeologisch Basisregister" },
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/1", label: "Woonhuiscategorie", sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/schema", sourceName: "Monumenten Registratie Systeem" },
  ]);
  assert.equal(calls.length, 3);
  assert.ok(calls.some((url) => url.includes("cht")));
  assert.ok(calls.some((url) => url.includes("datasets/thesauri/referentienetwerk")));
  assert.ok(calls.some((url) => url.includes("abr")));
});

test("labels a CHT-suggestie als Materialen of Stijlen en periodes op basis van de hoofdtak", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    if (String(input).includes("abr")) return Response.json({ results: { bindings: [] } });
    if (String(input).includes("datasets/thesauri/referentienetwerk")) return Response.json({ results: { bindings: [] } });
    return Response.json({ results: { bindings: [
      { concept: { value: "cht:steen" }, label: { value: "Utrechtse steen" }, isMateriaal: { value: "true" }, isStijlPeriode: { value: "false" } },
      { concept: { value: "cht:artdeco" }, label: { value: "art deco" }, isMateriaal: { value: "false" }, isStijlPeriode: { value: "true" } },
    ] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=steen", { headers: { "cf-connecting-ip": "terms-branches" } }));
  const body = await response.json();
  assert.equal(body.suggestions.find((item) => item.uri === "cht:steen")?.sourceName, "Cultuurhistorische Thesaurus - Materialen");
  assert.equal(body.suggestions.find((item) => item.uri === "cht:artdeco")?.sourceName, "Cultuurhistorische Thesaurus - Stijlen en periodes");
});

test("fails open when the RCE SPARQL-dienst niet bereikbaar is", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=kerk"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: true });
});
