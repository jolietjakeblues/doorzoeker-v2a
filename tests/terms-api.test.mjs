import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/terms/suggest/route.ts";

test("returns no suggestions for one character without an upstream call", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=w"));
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: false });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("gebruikt de twee CHO-relevante RN2-schema's plus gekoppelde CHT/ABR-onderwerpbegrippen voor suggesties", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("datasets/thesauri/referentienetwerk")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/1" }, label: { value: "Woonhuis" }, scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5" }, schemeLabel: { value: "Monumenten Registratie Systeem" } },
      ] } });
    }
    if (url.includes("heeftOmschrijvingOnderwerp")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/cht/9" }, label: { value: "woonhuizen" } },
      ] } });
    }
    return Response.json({ results: { bindings: [
      { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/1" }, field: { value: "functie" }, count: { value: "42" } },
    ] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=woon", { headers: { "cf-connecting-ip": "terms-success" } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.suggestions, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/1", label: "Woonhuis", sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5", sourceName: "Monumenten Registratie Systeem", conceptField: "functie", usageCount: 42 },
    { uri: "https://data.cultureelerfgoed.nl/term/id/cht/9", label: "woonhuizen", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus", sourceName: "Cultuurhistorische Thesaurus" },
  ]);
  assert.equal(calls.length, 3);
  assert.ok(calls.some((url) => url.includes("datasets/thesauri/referentienetwerk")));
  assert.ok(calls.some((url) => url.includes("heeftOmschrijvingOnderwerp")));
  assert.equal(calls.filter((url) => url.includes("datasets/rce/cho")).length, 2);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
  assert.equal(response.headers.get("x-doorzoeker-cache"), "MISS");

  const cachedResponse = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=woon"));
  assert.equal(cachedResponse.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
  assert.equal(cachedResponse.headers.get("x-doorzoeker-cache"), "HIT");
  assert.equal(calls.length, 3);
});

test("keeps suggestions available as text search when the usage check fails", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("datasets/thesauri/referentienetwerk")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/2" }, label: { value: "Moutmolen" }, scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5" }, schemeLabel: { value: "Monumenten Registratie Systeem" } },
      ] } });
    }
    if (url.includes("heeftOmschrijvingOnderwerp")) return Response.json({ results: { bindings: [] } });
    throw new Error("usage endpoint offline");
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=moutmolen", { headers: { "cf-connecting-ip": "terms-fallback" } }));
  assert.deepEqual((await response.json()).suggestions, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/2", label: "Moutmolen", sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5", sourceName: "Monumenten Registratie Systeem" },
  ]);
});

test("valt terug op alleen RN2-suggesties wanneer de gekoppelde-onderwerp-query faalt", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("datasets/thesauri/referentienetwerk")) {
      return Response.json({ results: { bindings: [
        { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/3" }, label: { value: "Kerktoren" }, scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5" }, schemeLabel: { value: "Monumenten Registratie Systeem" } },
      ] } });
    }
    if (url.includes("heeftOmschrijvingOnderwerp")) throw new Error("onderwerp endpoint offline");
    return Response.json({ results: { bindings: [] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=kerktoren", { headers: { "cf-connecting-ip": "terms-onderwerp-offline" } }));
  assert.deepEqual((await response.json()).suggestions, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/3", label: "Kerktoren", sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5", sourceName: "Monumenten Registratie Systeem" },
  ]);
});

test("fails open when the RCE SPARQL-dienst niet bereikbaar is", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=kerk"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
