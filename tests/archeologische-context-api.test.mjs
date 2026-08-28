import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/archeologische-context/route.ts";

const RM_WKT = "Point (5.0 52.0)";
const OG_WKT = "Polygon ((5.0 52.0, 5.1 52.0, 5.1 52.1, 5.0 52.1, 5.0 52.0))";

test("de vaste showcase-monument (14948, zie useVoorbeeldMonument.ts) slaat de dure bbox-kandidatenstap over - twee SPARQL-aanroepen, niet drie", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { return undefined; }, put() {} } };
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    // De exacte-toetsquery (fase 3) gaat via POST - de querytekst zit dan in
    // de request-body, niet in de URL (zie sparql-client.ts).
    const query = init?.body ? decodeURIComponent(String(init.body).replace(/^query=/, "")) : decodeURIComponent(String(input));
    if (query.includes("VALUES ?og")) {
      // Fase 3 (exacte toets) - moet de vooraf bekende kandidaten bevatten,
      // niet een leeg/anders opgebouwde VALUES-clausule.
      assert.match(query, /archeologischonderzoeksgebied\/2038140/);
      assert.match(query, /archeologischonderzoeksgebied\/2051204/);
      return Response.json({ results: { bindings: [{ og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204" }, choi: { value: "2051204" }, omschrijving: { value: "Gallo-Romeins tempelcomplex" }, wkt: { value: OG_WKT } }] } });
    }
    // Geen enkele aanroep hoort de bbox-kandidatenquery te zijn voor dit
    // monumentnummer.
    assert.doesNotMatch(query, /geof:sfWithin/);
    return Response.json({ results: { bindings: [{ wkt: { value: RM_WKT } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/archeologische-context?rijksmonumentnummer=14948", { headers: { "cf-connecting-ip": "test-voorbeeld-monument" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.gebieden.length, 1);
  assert.equal(document.gebieden[0].choNummer, "2051204");
  assert.equal(calls, 2);
});

test("elk ander monumentnummer doorloopt nog altijd de generieke, drie-staps flow (geen regressie door de showcase-kortsluiting)", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { return undefined; }, put() {} } };
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    const url = decodeURIComponent(String(input));
    if (url.includes("geof:sfWithin")) return Response.json({ results: { bindings: [{ og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/999" } }] } });
    if (url.includes("VALUES ?og")) return Response.json({ results: { bindings: [] } });
    return Response.json({ results: { bindings: [{ wkt: { value: RM_WKT } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/archeologische-context?rijksmonumentnummer=36046", { headers: { "cf-connecting-ip": "test-generiek-monument" } }));
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});
