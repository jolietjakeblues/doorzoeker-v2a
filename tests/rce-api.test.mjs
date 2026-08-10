import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/search/route.ts";

const SPARQL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const BIBLIOTHEEK_SPARQL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql";

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
    if (url.startsWith(BIBLIOTHEEK_SPARQL)) return Response.json({ results: { bindings: [] } });
    assert.match(url, new RegExp(`^${SPARQL.replaceAll(".", "\\.")}`));
    // The details query now also joins heeftBRKRelatie (for a gemeente
    // fallback), so match on "perceelnummer" - only the dedicated parcel
    // query selects it - instead of "heeftBRKRelatie".
    if (url.includes("perceelnummer")) {
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

test("rejects a concept-URI outside the known namespaces before contacting RCE", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?concept=https://example.com/evil", { headers: { "cf-connecting-ip": "test-concept-invalid" } }));
  assert.equal(response.status, 400);
});

test("does not require q when a valid concept-URI is present", async (context) => {
  // Referentienetwerk-integratie (taak #10): een concept-zoekopdracht is een
  // exacte URI-match, geen tekstzoekopdracht - q mag hier dus leeg zijn,
  // anders dan bij een gewone zoekopdracht.
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { throw new Error("cache unavailable"); }, put() { throw new Error("cache unavailable"); } } };
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21";
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("heeftMonumentAard") && url.includes("SELECT ?rmnr")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" } }] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "36046" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, monumentaard: { value: "onroerend gebouwd" }, monumentaardConcept: { value: conceptUri } }] } });
  };

  const response = await GET(new Request(`https://doorzoeker.test/api/rce/search?concept=${encodeURIComponent(conceptUri)}`, { headers: { "cf-connecting-ip": "test-concept-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "36046");
  assert.equal(document.results[0].monumentAardConceptUri, conceptUri);
});

test("dispatches to the archeologische-waardering concept search when veld=waardering, not monumentaard", async (context) => {
  // Fase 2 (2026-08-10): veld bepaalt expliciet via welke eigenschap
  // gezocht wordt - zonder deze parameter zou de route niet kunnen weten
  // welke van de twee concept-zoekopdrachten bedoeld is.
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { throw new Error("cache unavailable"); }, put() { throw new Error("cache unavailable"); } } };
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/31020cd0-9029-4609-bbd8-ee83f9baf3f4";
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("heeftMonumentAard") && url.includes("SELECT ?rmnr")) throw new Error("moet niet op monumentaard zoeken wanneer veld=waardering is meegegeven");
    if (url.includes("heeftArcheologischeWaardering") && url.includes("SELECT ?rmnr")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "45708" } }] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "45708" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:45708" }, choi: { value: "45708" }, rmnr: { value: "45708" } }] } });
  };

  const response = await GET(new Request(`https://doorzoeker.test/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=waardering`, { headers: { "cf-connecting-ip": "test-waardering-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "45708");
});

test("dispatches to the gebeurtenis concept search when veld=gebeurtenis", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { throw new Error("cache unavailable"); }, put() { throw new Error("cache unavailable"); } } };
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/a88b115d-ad65-4403-99aa-31210af8bd6d";
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("heeftMonumentAard") && url.includes("SELECT ?rmnr")) throw new Error("moet niet op monumentaard zoeken wanneer veld=gebeurtenis is meegegeven");
    if (url.includes("heeftGebeurtenisNaam") && url.includes("SELECT ?rmnr")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "10047" } }] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "10047" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:10047" }, choi: { value: "10047" }, rmnr: { value: "10047" } }] } });
  };

  const response = await GET(new Request(`https://doorzoeker.test/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=gebeurtenis`, { headers: { "cf-connecting-ip": "test-gebeurtenis-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "10047");
});

test("dispatches to the actor concept search when veld=actor", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { throw new Error("cache unavailable"); }, put() { throw new Error("cache unavailable"); } } };
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/f8c2048b-3ddb-4f4b-93d8-12d92b61598b";
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("heeftMonumentAard") && url.includes("SELECT ?rmnr")) throw new Error("moet niet op monumentaard zoeken wanneer veld=actor is meegegeven");
    if (url.includes("heeftActorEnRol") && url.includes("SELECT ?rmnr")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "10047" } }] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "10047" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:10047" }, choi: { value: "10047" }, rmnr: { value: "10047" } }] } });
  };

  const response = await GET(new Request(`https://doorzoeker.test/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=actor`, { headers: { "cf-connecting-ip": "test-actor-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "10047");
});

test("attaches gekoppelde literatuur from the separate rce/bibliotheek dataset onto a search result", async (context) => {
  // Taak #6 / slice 005: literatuur is een verrijking op het bestaande
  // /api/rce/search-contract, geen eigen route - net als groenaanleg en
  // msp_indicatie.
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
    if (url.startsWith(BIBLIOTHEEK_SPARQL)) {
      return Response.json({ results: { bindings: [{
        rmnr: { value: "18073" }, boek: { value: "https://linkeddata.cultureelerfgoed.nl/bib/id/001a40f9" },
        titel: { value: "De Laakmolen" }, jaar: { value: "1988" },
        sameAs: { value: "https://catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131" },
        auteurNaam: { value: "Ambachtsheer, H.F." },
      }] } });
    }
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [{ rmnr: { value: "18073" } }] } });
    return Response.json({ results: { bindings: [{ cho: { value: "rm:18073" }, choi: { value: "18073" }, rmnr: { value: "18073" } }] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=18073&page=1", { headers: { "cf-connecting-ip": "test-literatuur-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.deepEqual(document.results[0].literature, [{
    uri: "https://linkeddata.cultureelerfgoed.nl/bib/id/001a40f9", title: "De Laakmolen", year: "1988",
    authors: ["Ambachtsheer, H.F."], sourceUrl: "https://catalogus.cultureelerfgoed.nl/Details/fullCatalogue/1131",
  }]);
});

test("keeps name search working when another discovery branch is temporarily unavailable", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  globalThis.caches = { default: { match() { return undefined; }, put() {} } };
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.startsWith(BIBLIOTHEEK_SPARQL)) return Response.json({ results: { bindings: [] } });
    if (url.includes("SELECT DISTINCT ?rmnr ?match")) {
      if (url.includes("heeftOmschrijving")) return new Response("tijdelijk niet bereikbaar", { status: 503 });
      if (url.includes("heeftNaam/ceo:naam")) {
        return Response.json({ results: { bindings: [{ rmnr: { value: "517443" }, match: { value: "Kaaspakhuis" } }] } });
      }
      return Response.json({ results: { bindings: [] } });
    }
    if (url.includes("a ceo:Werelderfgoed") || url.includes("a ceo:Gezicht") || url.includes("a ceo:Complex") || url.includes("a ceo:ArcheologischOnderzoeksgebied")) {
      return Response.json({ results: { bindings: [] } });
    }
    if (url.includes("perceelnummer") || url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [] } });
    if (url.includes("SELECT ?cho ?choi ?rmnr")) {
      return Response.json({ results: { bindings: [{ cho: { value: "rm:517443" }, choi: { value: "cho-517443" }, rmnr: { value: "517443" }, naam: { value: "Kaaspakhuis" } }] } });
    }
    return Response.json({ results: { bindings: [] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=Kaaspakhuis&page=1", { headers: { "cf-connecting-ip": "test-name-fail-soft" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].name, "Kaaspakhuis");
  assert.equal(document.results[0].matchSource, "naam");
});
