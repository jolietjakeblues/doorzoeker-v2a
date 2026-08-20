import assert from "node:assert/strict";
import test from "node:test";
import { GET, secondsUntilNextUtcDay } from "../app/api/rce/op-deze-dag/route.ts";
import { fetchOpDezeDag } from "../lib/server/rce-adapter.ts";

test("calculates the cache lifetime up to the next UTC day", () => {
  assert.equal(secondsUntilNextUtcDay(new Date("2026-08-10T12:00:00.000Z")), 43_200);
  assert.equal(secondsUntilNextUtcDay(new Date("2026-08-10T23:59:30.000Z")), 30);
});

test("returns a built monument with an image from the constrained candidate query", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("SELECT DISTINCT ?rmnr WHERE") && url.includes("datumInschrijvingInMonumentenregister")) {
      return Response.json({ results: { bindings: [
        { rmnr: { value: "36046" } },
      ] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("functieConcepten")) return Response.json({ results: { bindings: [{ rmnr: { value: "36046" } }] } });
    if (url.includes("foaf:depiction") || url.includes("depictionValue")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" }, depiction: { value: "https://images.memorix.nl/rce/thumb/640x480/x.jpg" } }] } });
    }
    return Response.json({ results: { bindings: [{ cho: { value: "rm:36046" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis" } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.monument.monumentNumber, "36046");
  const cacheControl = response.headers.get("cache-control");
  assert.match(cacheControl, /^public, max-age=\d+, s-maxage=\d+$/);
  const sharedSeconds = Number(cacheControl.match(/s-maxage=(\d+)/)?.[1]);
  assert.ok(sharedSeconds >= 1 && sharedSeconds <= 86_400);
});

test("returns monument: null when there are no candidates at all", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { monument: null });
  const cacheControl = response.headers.get("cache-control");
  assert.match(cacheControl, /^public, max-age=\d+, s-maxage=\d+$/);
  const sharedSeconds = Number(cacheControl.match(/s-maxage=(\d+)/)?.[1]);
  assert.ok(sharedSeconds >= 1 && sharedSeconds <= 300);
});

test("fails with 502 when the RCE-service is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("uses the nearest previous calendar day when today has no built monument with an image", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const candidateDates = [];
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("SELECT DISTINCT ?rmnr WHERE") && url.includes("datumInschrijvingInMonumentenregister")) {
      const maandDag = url.match(/= "(\d{2}-\d{2})"/)?.[1];
      candidateDates.push(maandDag);
      return Response.json({ results: { bindings: maandDag === "08-10" ? [{ rmnr: { value: "517443" } }] : [] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("functieConcepten")) return Response.json({ results: { bindings: [{ rmnr: { value: "517443" } }] } });
    if (url.includes("foaf:depiction") || url.includes("depictionValue")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "517443" }, depiction: { value: "https://images.memorix.nl/rce/thumb/640x480/kaaspakhuis.jpg" } }] } });
    }
    return Response.json({ results: { bindings: [{ cho: { value: "rm:517443" }, choi: { value: "517443" }, rmnr: { value: "517443" }, functie: { value: "Pakhuis" } }] } });
  };

  const monument = await fetchOpDezeDag(undefined, new Date("2026-08-11T12:00:00.000Z"));
  assert.equal(monument?.monumentNumber, "517443");
  assert.deepEqual(candidateDates, ["08-11", "08-10"]);
});
