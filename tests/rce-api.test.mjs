import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/search/route.ts";

const SPARQL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";

test("rejects invalid application API input before contacting RCE", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=&page=0", { headers: { "cf-connecting-ip": "test-invalid" } }));
  assert.equal(response.status, 400);
});

test("returns a stable application API contract for a monument number", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { throw new Error("cache unavailable"); }, put() { throw new Error("cache unavailable"); } } };
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    assert.match(url, new RegExp(`^${SPARQL.replaceAll(".", "\\.")}`));
    if (url.includes("heeftBRKRelatie")) {
      return Response.json({ results: { bindings: [{ gemeente: { value: "Utrecht" }, sectie: { value: "B" }, perceel: { value: "358" } }] } });
    }
    if (url.includes("GROUP_CONCAT")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" }, oorspronkelijkeFuncties: { value: "Woonhuis(K)" } }] } });
    }
    return Response.json({ results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis(K)" }, omschrijving: { value: "Pand met lijstgevel." }, volledigAdres: { value: "Brigittenstraat 18" }, woonplaats: { value: "Utrecht" } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=36046&page=1", { headers: { "cf-connecting-ip": "test-success" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-doorzoeker-cache"), "MISS");
  assert.match(response.headers.get("server-timing") ?? "", /^rce;dur=\d+$/);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "36046");
  assert.equal(document.results[0].parcels[0].section, "B");

  const cached = await GET(new Request("https://doorzoeker.test/api/rce/search?q=36046&page=1", { headers: { "cf-connecting-ip": "test-success" } }));
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("x-doorzoeker-cache"), "HIT");
});
