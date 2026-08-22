import assert from "node:assert/strict";
import test from "node:test";
import { fetchSparql } from "../lib/server/sparql-client.ts";

test("herkanst tot 3 pogingen bij herhaalde 503's, geeft het resultaat van de eerste geslaagde poging terug (live geconstateerd 22-08-2026: RCE/MASS gaven soms twee 503's ná elkaar binnen hetzelfde verzoek)", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) return new Response("", { status: 503 });
    return Response.json({ results: { bindings: [] } });
  };

  const document = await fetchSparql("SELECT * WHERE {}");
  assert.deepEqual(document, { results: { bindings: [] } });
  assert.equal(calls, 3);
});

test("geeft het op na 3 mislukte pogingen, niet oneindig herkansen", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("", { status: 503 }); };

  await assert.rejects(() => fetchSparql("SELECT * WHERE {}"), /503/);
  assert.equal(calls, 3);
});

test("herkanst niet bij een 4xx-clientfout, geeft direct op", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("", { status: 400 }); };

  await assert.rejects(() => fetchSparql("SELECT * WHERE {}"), /400/);
  assert.equal(calls, 1);
});
