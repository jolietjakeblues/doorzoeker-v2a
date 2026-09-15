import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/wikidata/route.ts";

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

function request(nummer, ip = "test-wikidata") {
  return new Request(`https://doorzoeker.test/api/rce/wikidata?rijksmonumentnummer=${encodeURIComponent(nummer)}`, {
    headers: { "cf-connecting-ip": ip },
  });
}

test("400 bij een ongeldig rijksmonumentnummer", async () => {
  const response = await GET(request("niet-een-nummer"));
  assert.equal(response.status, 400);
});

test("bevraagt Wikidata's eigen SPARQL-endpoint, niet RCE, en geeft het gevonden item terug", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    assert.match(url, new RegExp(`^${WIKIDATA_ENDPOINT.replaceAll(".", "\\.")}`));
    assert.match(url, /wdt:P359 "14948"/);
    return Response.json({
      results: { bindings: [{ item: { value: "http://www.wikidata.org/entity/Q1771094" }, itemLabel: { value: "Grote Kerk" } }] },
    });
  };
  const response = await GET(request("14948"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { item: { itemUrl: "http://www.wikidata.org/entity/Q1771094", label: "Grote Kerk" } });
});

test("geeft item: null terug als Wikidata geen gekoppeld item heeft", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });
  const response = await GET(request("1", "test-wikidata-leeg"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { item: null });
});

test("stuurt een herkenbare User-Agent mee (Wikidata's gebruiksbeleid)", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let sentUserAgent;
  globalThis.fetch = async (_input, init) => {
    sentUserAgent = init?.headers?.["User-Agent"];
    return Response.json({ results: { bindings: [] } });
  };
  await GET(request("2", "test-wikidata-user-agent"));
  assert.match(sentUserAgent ?? "", /Doorzoeker/);
});

test("rate limiteert na 30 verzoeken per minuut", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });
  const ip = "test-wikidata-rate-limit";

  for (let i = 0; i < 30; i++) {
    const response = await GET(request("3", ip));
    assert.notEqual(response.status, 429, `verzoek ${i + 1} van 30 hoorde nog niet gelimiteerd te zijn`);
  }
  const limited = await GET(request("3", ip));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("fails with 502 when Wikidata is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await GET(request("4", "test-wikidata-offline"));
  assert.equal(response.status, 502);
});
