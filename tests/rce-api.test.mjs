import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/rce/search/route.ts";

const SPARQL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql";
const BIBLIOTHEEK_SPARQL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/bibliotheek/sparql";

test("rejects invalid application API input before contacting RCE", async () => {
  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=&page=0", { headers: { "cf-connecting-ip": "test-invalid" } }));
  assert.equal(response.status, 400);
});

test("rejects a 1-teken vrije-tekstzoekopdracht zonder de RCE-dienst te raadplegen (securityassessment 17-08-2026: dit is de duurst mogelijke CONTAINS-scan)", async (context) => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { fetchCalled = true; return Response.json({ results: { bindings: [] } }); };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=a", { headers: { "cf-connecting-ip": "test-min-length" } }));
  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});

test("staat een 1-cijferig rijksmonumentnummer nog altijd toe (geen regressie door de nieuwe minimumlengte)", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=7", { headers: { "cf-connecting-ip": "test-min-length-numeric" } }));
  assert.notEqual(response.status, 400);
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
      return Response.json({ results: { bindings: [{ rmnr: { value: "36046" }, gemeente: { value: "Utrecht" }, sectie: { value: "B" }, perceel: { value: "358" } }] } });
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

test("treats a short but valid rijksmonumentnummer as an exact lookup, not free text (P1: 'Vergelijkbare rijksmonumenten' zocht op '20')", async (context) => {
  // Rijksmonument 20 bestaat echt (vroege registratie) maar heeft maar twee
  // cijfers. Als "20" hier ten onrechte als vrije tekst wordt behandeld,
  // vindt geen enkele CONTAINS-discoverybron (allemaal leeg gemockt) iets en
  // faalt de hele zoekopdracht met een 502 - dat verschil bewijst het gedrag,
  // niet alleen de query-vorm.
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
    if (url.includes("SELECT ?cho ?choi ?rmnr") && url.includes('VALUES ?rmnr { "20" }')) {
      return Response.json({ results: { bindings: [{ cho: { value: "rm:10015" }, choi: { value: "10015" }, rmnr: { value: "20" }, naam: { value: "Herenhuis" } }] } });
    }
    return Response.json({ results: { bindings: [] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=20&page=1", { headers: { "cf-connecting-ip": "test-short-rmnr" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results.length, 1);
  assert.equal(document.results[0].monumentNumber, "20");
});

test("een falende exacte-nummerlookup laat een numerieke zoekopdracht niet meer als geheel mislukken, en cachet niet (securityassessment 17-08-2026: searchByNumber miste de optionalSearch-bescherming die de zes bijvangst-categorieën al hadden)", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  let cachePutCalls = 0;
  globalThis.caches = { default: { match() { return undefined; }, put() { cachePutCalls += 1; } } };
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.startsWith(BIBLIOTHEEK_SPARQL)) return Response.json({ results: { bindings: [] } });
    if (url.includes("VALUES ?choi")) return new Response("tijdelijk niet bereikbaar", { status: 503 });
    return Response.json({ results: { bindings: [] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=55501&page=1", { headers: { "cf-connecting-ip": "test-number-partial-fail" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const document = await response.json();
  assert.deepEqual(document.results, []);
  assert.equal(cachePutCalls, 0);
});

test("finds a Rijksmonument by CHO-nummer when it is not a valid rijksmonumentnummer (P1: 71286)", async (context) => {
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
    if (url.includes("GROUP_CONCAT")) return Response.json({ results: { bindings: [] } });
    if (url.includes("perceelnummer")) return Response.json({ results: { bindings: [] } });
    const monument = { cho: { value: "rm:71286" }, choi: { value: "71286" }, rmnr: { value: "519471" }, naam: { value: "Herenhuis Tolsedijk" } };
    if (url.includes("VALUES ?choi")) return Response.json({ results: { bindings: [monument] } });
    // De CHO-nummer-lookup levert alleen het rijksmonumentnummer op; de
    // gewone detailquery (buildRceDetailsQuery, ditmaal met dat gevonden
    // rmnr) haalt daarna via dezelfde gedeelde buildMonumentsFromNumbers-weg
    // het volledige record op - net als bij een rechtstreekse
    // rijksmonumentnummer-zoekopdracht.
    if (url.includes("SELECT ?cho ?choi ?rmnr") && url.includes("519471")) {
      return Response.json({ results: { bindings: [monument] } });
    }
    // Alle overige parallelle branches (complexnummer, archeologische
    // terreinen/vondstlocaties/..., MSP, groenaanleg, ...): "71286" en
    // "519471" zijn daar niet relevant, dus die leveren niets op.
    return Response.json({ results: { bindings: [] } });
  };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=71286&page=1", { headers: { "cf-connecting-ip": "test-cho-nummer" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results.length, 1);
  assert.equal(document.results[0].monumentNumber, "519471");
  assert.equal(document.results[0].matchSource, "CHO-nummer (rijksmonument)");
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

test("dispatches to the archeologische-waardering concept search when veld=waardering, matching op het eigen CHO-nummer van het terrein (P1: niet via ligtInObject)", async (context) => {
  // Fase 2 (2026-08-10): veld bepaalt expliciet via welke eigenschap
  // gezocht wordt - zonder deze parameter zou de route niet kunnen weten
  // welke van de twee concept-zoekopdrachten bedoeld is.
  // 15 augustus 2026: query matcht nu op het eigen CHO-nummer van het
  // ArcheologischTerrein, niet meer op een gekoppeld rijksmonumentnummer
  // (~86% van de terreinen met een waardering heeft geen ligtInObject-
  // relatie naar een Rijksmonument, zie CHO 6042545).
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
    if (url.includes("heeftMonumentAard")) throw new Error("moet niet op monumentaard zoeken wanneer veld=waardering is meegegeven");
    if (url.includes("heeftArcheologischeWaardering") && !url.includes("VALUES")) {
      return Response.json({ results: { bindings: [{ rmnr: { value: "6042545" } }] } });
    }
    if (url.includes("a ceo:ArcheologischTerrein") && url.includes("VALUES ?choi")) {
      return Response.json({ results: { bindings: [{
        terrein: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischterrein/6042545" },
        choi: { value: "6042545" },
        naam: { value: "Zonder rijksmonumentkoppeling" },
      }] } });
    }
    return Response.json({ results: { bindings: [] } });
  };

  const response = await GET(new Request(`https://doorzoeker.test/api/rce/search?concept=${encodeURIComponent(conceptUri)}&veld=waardering`, { headers: { "cf-connecting-ip": "test-waardering-p1-success" } }));
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.results[0].monumentNumber, "6042545");
  assert.equal(document.results[0].name, "Zonder rijksmonumentkoppeling");
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

test("copies a Cloudflare cache hit into a response with mutable headers", async (context) => {
  const originalCaches = globalThis.caches;
  context.after(() => {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  const cached = new Response(JSON.stringify({ results: [], page: 1, hasMore: false }), {
    headers: { "Content-Type": "application/json", "X-Doorzoeker-Cache": "HIT" },
  });
  const immutableHeaders = new Headers(cached.headers);
  immutableHeaders.set = () => { throw new TypeError("Can't modify immutable headers."); };
  Object.defineProperty(cached, "headers", { value: immutableHeaders });
  globalThis.caches = { default: { match() { return cached; }, put() {} } };

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=cachetest", { headers: { "cf-connecting-ip": "cache-copy" } }));
  assert.equal(response.status, 200);
  assert.doesNotThrow(() => response.headers.set("X-Vinext-Test", "ok"));
  assert.equal(response.headers.get("X-Vinext-Test"), "ok");
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

test("cachet een tekstzoekopdracht niet als een categorie tijdelijk faalt (gemeld door de eigenaar: doorklik naar CHO 10001066 gaf 0 resultaten)", async (context) => {
  // Reproductie van het gemelde probleem: een Archeologisch onderzoeksgebied
  // (CHO 10001066) is alleen vindbaar via de onderzoeksgebieden-categorie.
  // Als die ene SPARQL-tak tijdelijk hapert (503), valt searchByText terug
  // op een lege lijst voor die categorie (optionalSearch) - de zoekopdracht
  // als geheel blijft dus "geldig" 0 resultaten opleveren. Zonder de
  // partialFailure-tracker zou dat onvolledige antwoord alsnog 5 minuten
  // gecachet worden en aan iedereen als "geen resultaten" geserveerd worden,
  // ook nadat de RCE-tak weer bereikbaar is.
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  let onderzoeksgebiedCalls = 0;
  let cachePutCalls = 0;
  globalThis.caches = { default: { match() { return undefined; }, put() { cachePutCalls += 1; } } };
  globalThis.fetch = async (input) => {
    const url = decodeURIComponent(String(input));
    if (url.startsWith(BIBLIOTHEEK_SPARQL)) return Response.json({ results: { bindings: [] } });
    if (url.includes("ArcheologischOnderzoeksgebied") && url.includes("cultuurhistorischObjectnummer")) {
      onderzoeksgebiedCalls += 1;
      return new Response("tijdelijk niet bereikbaar", { status: 503 });
    }
    return Response.json({ results: { bindings: [] } });
  };

  const request = () => GET(new Request("https://doorzoeker.test/api/rce/search?q=10001066&page=1", { headers: { "cf-connecting-ip": "test-partial-fail-no-cache" } }));

  const first = await request();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("x-doorzoeker-cache"), "SKIP");
  const firstDocument = await first.json();
  assert.deepEqual(firstDocument.results, []);
  assert.equal(cachePutCalls, 0);
  const callsAfterFirst = onderzoeksgebiedCalls;
  assert.ok(callsAfterFirst > 0);

  // Een tweede, identieke zoekopdracht moet de gefaalde tak opnieuw
  // proberen - bewijst dat het eerste (onvolledige) antwoord niet in de
  // in-memory responseCache of de Cloudflare Cache API is beland.
  const second = await request();
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-doorzoeker-cache"), "SKIP");
  assert.ok(onderzoeksgebiedCalls > callsAfterFirst);
});

test("cachet een geslaagde tekstzoekopdracht nog altijd normaal (geen regressie door de partialFailure-tracker)", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  });
  let cachePutCalls = 0;
  globalThis.caches = { default: { match() { return undefined; }, put() { cachePutCalls += 1; } } };
  globalThis.fetch = async () => Response.json({ results: { bindings: [] } });

  const response = await GET(new Request("https://doorzoeker.test/api/rce/search?q=geenmatch&page=1", { headers: { "cf-connecting-ip": "test-full-success-still-caches" } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);
  assert.equal(response.headers.get("x-doorzoeker-cache"), "MISS");
  assert.equal(cachePutCalls, 1);
});
