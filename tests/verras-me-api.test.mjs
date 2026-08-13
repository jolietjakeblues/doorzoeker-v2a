import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/verras-me/route.ts";
import { pickRandomCandidate } from "../lib/rce.ts";

test("pickRandomCandidate returns undefined for an empty pool", () => {
  assert.equal(pickRandomCandidate([]), undefined);
});

test("pickRandomCandidate always picks from the deduplicated pool", () => {
  const candidates = [
    { monumentNumber: "1" },
    { monumentNumber: "2" },
    { monumentNumber: "1" },
  ];
  for (let i = 0; i < 20; i += 1) {
    const chosen = pickRandomCandidate(candidates);
    assert.ok(["1", "2"].includes(chosen));
  }
});

test("returns a built monument with an image, never cached", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalRandom = Math.random;
  context.after(() => { globalThis.fetch = originalFetch; Math.random = originalRandom; });
  Math.random = () => 0;
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("SELECT DISTINCT ?rmnr WHERE") && url.includes("datumInschrijvingInMonumentenregister")) {
      return Response.json({ results: { bindings: [
        { rmnr: { value: "36046" } },
      ] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "36046" } }] } });
    if (url.includes("foaf:depiction") || url.includes("depictionValue")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" }, depiction: { value: "https://images.memorix.nl/rce/thumb/640x480/x.jpg" } }] } });
    }
    return Response.json({ results: { bindings: [{ cho: { value: "rm:36046" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis" } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/verras-me"));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.monument.monumentNumber, "36046");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("returns monument: null when no candidates are found for any attempted day", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(new Request("https://doorzoeker.test/api/rce/verras-me"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { monument: null });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("fails with 502 when the RCE-service is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/verras-me"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("kan ook de 29e, 30e of 31e van een maand kiezen, niet alleen dag 1-28 (TD-15)", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalRandom = Math.random;
  context.after(() => { globalThis.fetch = originalFetch; Math.random = originalRandom; });
  // Eerste Math.random()-aanroep kiest de maand, tweede de dag: 0.95 -> maand
  // 12 (december), 0.98 -> dag 31 van 31. De oude implementatie kon "31" als
  // dag nooit produceren, ongeacht de random-waarde.
  const randomValues = [0.95, 0.98];
  let call = 0;
  Math.random = () => randomValues[call++] ?? 0;
  const requestedDays = [];
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    const maandDag = url.match(/= "(\d{2}-\d{2})"/)?.[1];
    if (maandDag) requestedDays.push(maandDag);
    return Response.json({ results: { bindings: [] } });
  };

  await GET(new Request("https://doorzoeker.test/api/rce/verras-me"));
  assert.equal(requestedDays[0], "12-31");
});
