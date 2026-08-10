import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/terms/suggest/route.ts";

test("returns no suggestions for one character without an upstream call", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=w"));
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: false });
});

test("uses only the four CHO-related schemes in Referentienetwerk 2 for suggestions", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return Response.json({ results: { bindings: [
      { concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/1" }, label: { value: "Woonhuis" }, scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5" }, schemeLabel: { value: "Monumenten Registratie Systeem" } },
    ] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=woon", { headers: { "cf-connecting-ip": "terms-success" } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.suggestions, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/1", label: "Woonhuis", sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/3f786c78-e111-4545-be64-f79f495f73f5", sourceName: "Monumenten Registratie Systeem" },
  ]);
  assert.equal(calls.length, 1);
  assert.ok(calls.some((url) => url.includes("datasets/thesauri/referentienetwerk")));
});

test("fails open when the RCE SPARQL-dienst niet bereikbaar is", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=kerk"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: true });
});
