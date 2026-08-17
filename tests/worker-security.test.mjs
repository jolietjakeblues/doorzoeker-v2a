import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const u = new URL("../dist/server/index.js", import.meta.url);
  u.searchParams.set("test", String(Date.now()));
  const { default: w } = await import(u.href);
  return w;
}

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("stuurt een plat-http-verzoek naar een echte host door naar https (securityassessment 17-08-2026: live bevestigd dat de Worker anders gewoon 200 teruggaf over http)", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://doorzoekerfgoed.nl/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://doorzoekerfgoed.nl/");
});

test("laat lokale dev (http://localhost) ongemoeid, geen redirect", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
});

test("voegt basisbeveiligingsheaders toe aan een normale pagina-respons", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("https://doorzoekerfgoed.nl/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  // Geen includeSubDomains (zie toelichting in worker/index.ts).
  assert.doesNotMatch(response.headers.get("strict-transport-security") ?? "", /includeSubDomains/);
});
