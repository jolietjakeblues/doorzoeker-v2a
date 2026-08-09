import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/concept/route.ts";

const REFERENTIENETWERK = "https://api.linkeddata.cultureelerfgoed.nl/datasets/thesauri/referentienetwerk/sparql";

test("rejects a concept-URI outside the known namespaces", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/rce/concept?uri=https://example.com/evil"));
  assert.equal(response.status, 400);
});

test("resolves a monumentaard concept-URI against the Referentienetwerk-endpoint, not rce/cho", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21";
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    assert.match(url, new RegExp(`^${REFERENTIENETWERK.replaceAll(".", "\\.")}`));
    return Response.json({ results: { bindings: [{
      label: { value: "onroerend gebouwd" },
      scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/cho-scheme" },
      schemeLabel: { value: "Cultuurhistorische Object Informatie" },
    }] } });
  };
  const response = await GET(new Request(`https://doorzoeker.test/api/rce/concept?uri=${encodeURIComponent(conceptUri)}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    uri: conceptUri,
    label: "onroerend gebouwd",
    schemeUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/cho-scheme",
    schemeLabel: "Cultuurhistorische Object Informatie",
  });
});

test("returns 404 when the Referentienetwerk-endpoint has no such concept", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/00000000-0000-0000-0000-000000000000";
  const response = await GET(new Request(`https://doorzoeker.test/api/rce/concept?uri=${encodeURIComponent(uri)}`));
  assert.equal(response.status, 404);
});

test("fails with 502 when the Referentienetwerk-service is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21";
  const response = await GET(new Request(`https://doorzoeker.test/api/rce/concept?uri=${encodeURIComponent(uri)}`));
  assert.equal(response.status, 502);
});
