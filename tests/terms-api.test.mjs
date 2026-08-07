import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/terms/suggest/route.ts";

test("returns no suggestions for one character without an upstream call", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=w"));
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: false });
});

test("normalizes translated Term Network suggestions", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    assert.deepEqual(request.variables.sources, [
      "https://data.cultureelerfgoed.nl/term/id/cht",
      "https://data.cultureelerfgoed.nl/term/id/cht#materials",
      "https://data.cultureelerfgoed.nl/term/id/cht#styles-and-periodes",
    ]);
    return Response.json({ data: { terms: [{ source: { uri: request.variables.sources[0], name: "Cultuurhistorische Thesaurus" }, result: { __typename: "TranslatedTerms", terms: [{ uri: "urn:term:woonhuis", prefLabel: [{ language: "nl", value: "Woonhuis" }] }] } }] } });
  };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=woon", { headers: { "cf-connecting-ip": "terms-success" } }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).suggestions, [{ uri: "urn:term:woonhuis", label: "Woonhuis", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht", sourceName: "Cultuurhistorische Thesaurus" }]);
});

test("fails open when the Term Network is unavailable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await GET(new Request("https://doorzoeker.test/api/terms/suggest?q=kerk"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { suggestions: [], unavailable: true });
});
