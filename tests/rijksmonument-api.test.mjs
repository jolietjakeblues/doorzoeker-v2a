import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/rijksmonument/route.ts";

function jsonRequest(url) {
  return new Request(url, { headers: { "cf-connecting-ip": "test-rijksmonument" } });
}

test("geeft het exacte Rijksmonument terug op basis van ceo:rijksmonumentnummer, geen fan-out naar andere objectsoorten", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("functieConcepten")) return Response.json({ results: { bindings: [{ rmnr: { value: "14948" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:14948" }, choi: { value: "59284" }, rmnr: { value: "14948" }, functie: { value: "Kerk" } }] } });
  };

  const response = await GET(jsonRequest("https://doorzoeker.test/api/rce/rijksmonument?nummer=14948"));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.monument.monumentNumber, "14948");
});

test("400 bij een niet-numeriek nummer", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("fetch had niet aangeroepen mogen worden"); };

  const response = await GET(jsonRequest("https://doorzoeker.test/api/rce/rijksmonument?nummer=abc"));
  assert.equal(response.status, 400);
});

test("geeft monument: null als het rijksmonumentnummer niet bestaat", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(jsonRequest("https://doorzoeker.test/api/rce/rijksmonument?nummer=999999"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { monument: null });
});

test("fails with 502 when the RCE-service is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };

  const response = await GET(jsonRequest("https://doorzoeker.test/api/rce/rijksmonument?nummer=14948"));
  assert.equal(response.status, 502);
});
