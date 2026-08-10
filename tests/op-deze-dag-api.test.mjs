import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/op-deze-dag/route.ts";

test("returns a monument with an image when a candidate has one", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("datumInschrijvingInMonumentenregister")) {
      return Response.json({ results: { bindings: [
        { rmnr: { value: "18073" }, heeftFoto: { value: "false" } },
        { rmnr: { value: "36046" }, heeftFoto: { value: "true" } },
      ] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "36046" } }] } });
    if (url.includes("foaf:depiction") || url.includes("depictionValue")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" }, depiction: { value: "https://images.memorix.nl/rce/thumb/640x480/x.jpg" } }] } });
    }
    return Response.json({ results: { bindings: [{ cho: { value: "rm:36046" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis" } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.monument.monumentNumber, "36046");
});

test("returns monument: null when there are no candidates at all", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { monument: null });
});

test("fails with 502 when the RCE-service is unreachable", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error("offline"); };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/op-deze-dag"));
  assert.equal(response.status, 502);
});
