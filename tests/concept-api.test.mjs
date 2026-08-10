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

test("accepts a bare rn/<uuid> actor-URI (namespace for graph/actorenrol), but still 404s here since this route only queries the Referentienetwerk-endpoint", async (context) => {
  // Slice 007 (bouwgeschiedenis): actor-concept-URI's leven in rce/cho's
  // aparte actorenrol-graph, niet op het Referentienetwerk-endpoint dat
  // deze route bevraagt. De URI-validatie staat rn/<uuid> nu wel toe (voor
  // /api/rce/search?veld=actor, dat wél de juiste graph gebruikt), maar
  // deze route kan zo'n URI nog niet daadwerkelijk oplossen.
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/f8c2048b-3ddb-4f4b-93d8-12d92b61598b";
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
