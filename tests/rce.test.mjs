import assert from "node:assert/strict";
import test from "node:test";
import { buildArcheologischTerreinQuery, buildComplexQuery, buildGezichtQuery, buildRceDiscoveryQueries, buildRceFacetsQuery, buildRceNumberQuery, buildRceParcelQuery, buildWerelderfgoedQuery, mergeDiscoveryMatches, parseArcheologischTerreinResults, parseComplexResults, parseDiscoveryBranchResults, parseGezichtResults, parseParcelResults, parseRceMonuments, parseSparqlResults, parseWerelderfgoedResults, provinceName, RCE_SEMANTICS } from "../lib/rce.ts";

const CEO = "https://linkeddata.cultureelerfgoed.nl/def/ceo#";
const graph = [
  { "@id": "bag:1", [`${CEO}openbareRuimte`]: [{ "@value": "Brigittenstraat" }], [`${CEO}huisnummer`]: [{ "@value": "18" }], [`${CEO}postcode`]: [{ "@value": "3512KM" }] },
  { "@id": "basis:1", [`${CEO}heeftBAGRelatie`]: [{ "@id": "bag:1" }] },
  { "@id": "rm:38342", "@type": [`${CEO}Rijksmonument`], [`${CEO}rijksmonumentnummer`]: [{ "@value": "https://monumentenregister.cultureelerfgoed.nl/monumenten/36046" }], [`${CEO}cultuurhistorischObjectnummer`]: [{ "@value": "38342" }], [`${CEO}datumInschrijvingInMonumentenregister`]: [{ "@value": "1967-06-20" }], [`${CEO}heeftBasisregistratieRelatie`]: [{ "@id": "basis:1" }] },
];

test("parses an official RCE JSON-LD graph", () => {
  assert.deepEqual(parseRceMonuments(graph), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "Brigittenstraat", houseNumber: "18", postalCode: "3512KM", sourceUrl: "rm:38342" }]);
});

test("parses rich SPARQL results", () => {
  // RCE returns WKT as "Point (lng lat)" - lowercase and with a space before
  // the parenthesis. A stricter regex silently dropped lat/lng for every
  // result, which emptied the map without ever failing a request.
  const document = { results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis(K)" }, omschrijving: { value: "Pand met 17e eeuwse lijstgevel." }, monumentaard: { value: "onroerend gebouwd" }, volledigAdres: { value: "Brigittenstraat 18" }, postcode: { value: "3512KM" }, woonplaats: { value: "Utrecht" }, wkt: { value: "Point (5.1267842049703 52.088895166661)" }, inschrijving: { value: "1967-06-20" } }] } };
  assert.deepEqual(parseSparqlResults(document), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "", houseNumber: "", postalCode: "3512KM", sourceUrl: "rm:38342", name: undefined, functionName: "Woonhuis(K)", originalFunctionNames: [], currentFunctionNames: [], typeNames: [], legalStatus: "rijksmonument", description: "Pand met 17e eeuwse lijstgevel.", monumentNature: "onroerend gebouwd", fullAddress: "Brigittenstraat 18", place: "Utrecht", municipality: undefined, provinceCode: undefined, lng: 5.1267842049703, lat: 52.088895166661, wkt: "Point (5.1267842049703 52.088895166661)" }]);
});

test("falls back to the BRK gemeente when there is no BAG woonplaats", () => {
  // Archeologische terreinen hebben doorgaans geen BAG-relatie (geen adres),
  // maar wel een BRK-relatie (kadastraal perceel) met een gemeentenaam.
  const document = { results: { bindings: [{ cho: { value: "rm:1" }, choi: { value: "1" }, rmnr: { value: "45439" }, monumentaard: { value: "archeologisch" }, gemeente: { value: "Ambt-Hardenberg" }, provinciecode: { value: "OV" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.place, "Ambt-Hardenberg");
  assert.equal(monument.municipality, "Ambt-Hardenberg");
  assert.equal(monument.provinceCode, "OV");
});

test("prefers the BAG woonplaats over the BRK gemeente when both are present", () => {
  const document = { results: { bindings: [{ cho: { value: "rm:1" }, choi: { value: "1" }, rmnr: { value: "36046" }, woonplaats: { value: "Utrecht" }, gemeente: { value: "Utrecht" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.place, "Utrecht");
});

test("maps a BRK provinciecode to its full province name", () => {
  assert.equal(provinceName("OV"), "Overijssel");
  assert.equal(provinceName("ZH"), "Zuid-Holland");
  // RCE gebruikt "ZL" voor Zeeland, niet de vaker gebruikte ISO-code "ZE" -
  // live geverifieerd via de BRK-provinciecode-waarden in de dataset zelf.
  assert.equal(provinceName("ZL"), "Zeeland");
  assert.equal(provinceName(undefined), undefined);
  assert.equal(provinceName("XX"), "XX");
});

test("derives a marker position from a Polygon by averaging its vertices", () => {
  // Archeologische terreinen zijn vrijwel altijd een (Multi)Polygon, geen
  // Point. Zonder deze fallback kregen ze nooit lat/lng, ook al leverde RCE
  // wel degelijk geometrie - de kaart bleef stil leeg zonder foutmelding.
  const wkt = "Polygon ((5.0 52.0, 5.0 52.2, 5.2 52.2, 5.2 52.0))";
  const document = { results: { bindings: [{ rmnr: { value: "1" }, wkt: { value: wkt } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.lng, 5.1);
  assert.equal(monument.lat, 52.1);
});

test("derives a marker position from a MultiPolygon with equally-sized rings by averaging the first one", () => {
  const wkt = "MultiPolygon (((5.0 52.0, 5.0 52.2, 5.2 52.2, 5.2 52.0)), ((6.0 53.0, 6.0 53.2, 6.2 53.2, 6.2 53.0)))";
  const document = { results: { bindings: [{ rmnr: { value: "1" }, wkt: { value: wkt } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.lng, 5.1);
  assert.equal(monument.lat, 52.1);
});

test("picks the ring with the largest bounding box instead of blending disjoint parts (the Waddenzee bug)", () => {
  // Een MultiPolygon met los van elkaar liggende delen - bv. de Waddenzee,
  // eilanden en wadplaten over honderden kilometers kust - gaf met een platte
  // gemiddelde over alle coördinaten een punt ergens in de lege ruimte
  // tussen die delen: een kaartmarker die middenin de Achterhoek belandde in
  // plaats van in zee. Een klein, ver weg gelegen "eiland" (deze tweede ring)
  // mag het resultaat dus niet naar zich toe trekken.
  const dominant = "5.0 53.0, 5.0 53.2, 7.0 53.2, 7.0 53.0";
  const distantSliver = "50.0 10.0, 50.0 10.01, 50.01 10.01, 50.01 10.0";
  const wkt = `MultiPolygon (((${dominant})), ((${distantSliver})))`;
  const document = { results: { bindings: [{ rmnr: { value: "1" }, wkt: { value: wkt } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.lng, 6.0);
  assert.equal(monument.lat, 53.1);
});

test("leaves lat/lng undefined when there is no geometry at all", () => {
  const document = { results: { bindings: [{ rmnr: { value: "1" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.lat, undefined);
  assert.equal(monument.lng, undefined);
});

test("queries and parses BRK parcels separately", () => {
  const query = buildRceParcelQuery("36046");
  assert.match(query, /ceo:heeftBRKRelatie/);
  assert.doesNotMatch(query, /ceo:heeftBAGRelatie/);
  const document = { results: { bindings: [{ gemeente: { value: "Utrecht" }, gemeentecode: { value: "996" }, sectie: { value: "B" }, perceel: { value: "358" }, provinciecode: { value: "UT" } }] } };
  assert.deepEqual(parseParcelResults(document), [{ municipality: "Utrecht", municipalityCode: "996", section: "B", parcelNumber: "358", provinceCode: "UT" }]);
});

test("escapes monument numbers in BRK parcel queries", () => {
  const query = buildRceParcelQuery('36046" . ?subject ?predicate ?object #');
  assert.match(query, /36046\\" \. \?subject \?predicate \?object #/);
  assert.doesNotMatch(query, /rijksmonumentnummer "36046" \. \?subject/);
});

test("only queries formally established descriptions", () => {
  const query = buildRceNumberQuery("36046");
  assert.match(query, new RegExp(`GRAPH <${RCE_SEMANTICS.instancesGraph}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /ceo:heeftOmschrijving \?omschrijvingNode/);
  assert.match(query, /ceo:omschrijving \?omschrijvingValue/);
  assert.match(query, /ceo:formeelStandpunt true/);
  // Gemeente via BRK is een fallback-plaatsaanduiding voor records zonder
  // BAG-relatie (bv. archeologische terreinen).
  assert.match(query, /ceo:heeftBRKRelatie \?brk/);
  assert.match(query, /ceo:gemeentenaam \?gemeenteValue/);
  assert.match(query, /ceo:provinciecode \?provinciecodeValue/);
});

test("queries formal original and current functions as separate facets", () => {
  const query = buildRceFacetsQuery(["36046", "1"]);
  assert.match(query, /ceo:heeftOorspronkelijkeFunctie \?oorspronkelijkeNode/);
  assert.match(query, /ceo:heeftHuidigeFunctie \?huidigeNode/);
  assert.equal((query.match(/ceo:formeelStandpunt true/g) ?? []).length, 2);
  assert.match(query, /ceo:heeftType\/ceo:heeftTypeNaam\/skos:prefLabel/);
});

test("discovers functions, types and descriptions as separate fast queries per source", () => {
  const queries = buildRceDiscoveryQueries('woonhuis "K"');
  assert.deepEqual(queries.map((q) => q.bron), ["oorspronkelijke functie", "huidige functie", "type", "monumentaard", "formele omschrijving", "woonplaats"]);
  for (const { query } of queries) {
    assert.match(query, /graph\/instanties-rce/);
    assert.match(query, /ceo:heeftJuridischeStatus/);
    assert.match(query, /woonhuis \\"K\\"/);
    // Each source is its own query: no UNION, no ORDER BY, no cross-source
    // scoring in SPARQL. That's what keeps every one of them fast on a
    // 58M-triple graph instead of timing out like the combined query did.
    assert.doesNotMatch(query, /UNION/);
    assert.doesNotMatch(query, /ORDER BY/);
  }
  const oorspronkelijkeFunctie = queries.find((q) => q.bron === "oorspronkelijke functie").query;
  assert.match(oorspronkelijkeFunctie, /ceo:heeftOorspronkelijkeFunctie \?functieNode/);
  assert.match(oorspronkelijkeFunctie, /\?functieNode ceo:formeelStandpunt true/);
  const omschrijving = queries.find((q) => q.bron === "formele omschrijving").query;
  assert.match(omschrijving, /ceo:formeelStandpunt true/);
});

test("merges discovery branches, dedupes by best score, and sorts for page-style slicing", () => {
  const branchA = [{ monumentNumber: "1", matchSource: "type", matchedText: "Woonhuis", matchScore: 30 }];
  const branchB = [
    { monumentNumber: "2", matchSource: "oorspronkelijke functie", matchedText: "Woonhuis", matchScore: 10 },
    { monumentNumber: "1", matchSource: "monumentaard", matchedText: "Woonhuis", matchScore: 40 },
  ];
  const merged = mergeDiscoveryMatches([branchA, branchB]);
  assert.deepEqual(merged.map((m) => m.monumentNumber), ["2", "1"]);
  assert.equal(merged[1].matchScore, 30, "keeps the better (lower) score when a monument appears in multiple branches");
});

test("deduplicates matches and prefers a function over a description", () => {
  const omschrijvingMatches = parseDiscoveryBranchResults({ results: { bindings: [{ rmnr: { value: "36046" }, match: { value: "Pand met lijstgevel" } }] } }, "formele omschrijving", "lijstgevel");
  const functieMatches = parseDiscoveryBranchResults({ results: { bindings: [{ rmnr: { value: "36046" }, match: { value: "Woonhuis(K)" } }] } }, "oorspronkelijke functie", "woonhuis(k)");
  assert.deepEqual(mergeDiscoveryMatches([omschrijvingMatches, functieMatches]), [{ monumentNumber: "36046", matchSource: "oorspronkelijke functie", matchedText: "Woonhuis(K)", matchScore: 10 }]);
});

test("prefers the lowest semantic match score regardless of binding order", () => {
  const omschrijvingMatches = parseDiscoveryBranchResults({ results: { bindings: [{ rmnr: { value: "1" }, match: { value: "Een woonhuis in context" } }] } }, "formele omschrijving", "woonhuis");
  const functieMatches = parseDiscoveryBranchResults({ results: { bindings: [{ rmnr: { value: "1" }, match: { value: "Woonhuis" } }] } }, "oorspronkelijke functie", "woonhuis");
  const merged = mergeDiscoveryMatches([omschrijvingMatches, functieMatches]);
  assert.equal(merged[0].matchScore, 10);
  assert.equal(merged[0].matchSource, "oorspronkelijke functie");
});

test("looks up archaeological terreinen by the monument's own CHO subject URI", () => {
  const query = buildArcheologischTerreinQuery(["https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/45708"]);
  assert.match(query, /ceo:ligtInObject/);
  assert.match(query, /ceo:archis2Monumentnummer/);
  assert.match(query, /ceo:heeftArcheologischeWaardering\/skos:prefLabel/);
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/45708>/);
});

test("groups multiple archaeological terreinen under the same monument", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, terrein: { value: "terrein:a" }, archisNummer: { value: "2284" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
    { rm: { value: "rm:1" }, terrein: { value: "terrein:b" }, archisNummer: { value: "1037" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
    { rm: { value: "rm:2" }, terrein: { value: "terrein:c" }, archisNummer: { value: "525" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
  ] } };
  const byMonument = parseArcheologischTerreinResults(document);
  assert.deepEqual(byMonument.get("rm:1"), [
    { archisMonumentnummer: "2284", waardering: "zeer hoge archeologische waarde beschermd" },
    { archisMonumentnummer: "1037", waardering: "zeer hoge archeologische waarde beschermd" },
  ]);
  assert.equal(byMonument.get("rm:2").length, 1);
});

test("looks up complex membership by the monument's own CHO subject URI", () => {
  const query = buildComplexQuery(["https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/65311"]);
  assert.match(query, /ceo:heeftRijksmonument \?rm/);
  assert.match(query, /ceo:complexnummer/);
  assert.match(query, /ceo:heeftHoofdobject/);
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/65311>/);
});

test("marks a monument as hoofdobject only when it equals the complex's own heeftHoofdobject value", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:onderdeel" }, complex: { value: "complex:1" }, complexnummerValue: { value: "531014" }, complexnaam: { value: "Rijnoord" }, hoofdobjectValue: { value: "rm:hoofdobject" } },
    { rm: { value: "rm:hoofdobject" }, complex: { value: "complex:1" }, complexnummerValue: { value: "531014" }, complexnaam: { value: "Rijnoord" }, hoofdobjectValue: { value: "rm:hoofdobject" } },
  ] } };
  const byMonument = parseComplexResults(document);
  assert.deepEqual(byMonument.get("rm:onderdeel"), [{ complexnummer: "531014", complexnaam: "Rijnoord", role: "onderdeel" }]);
  assert.deepEqual(byMonument.get("rm:hoofdobject"), [{ complexnummer: "531014", complexnaam: "Rijnoord", role: "hoofdobject" }]);
});

test("looks up Werelderfgoed across both the instanties-rce and werelderfgoed_hvdl graphs", () => {
  // Werelderfgoed staat met dezelfde subject-URI in twee graphs: naam en
  // geometrie in instanties-rce, type/jaar/UNESCO-link in werelderfgoed_hvdl.
  const query = buildWerelderfgoedQuery("Schokland");
  assert.match(query, /a ceo:Werelderfgoed/);
  assert.match(query, new RegExp(`GRAPH <${RCE_SEMANTICS.instancesGraph}>`));
  assert.match(query, /GRAPH <https:\/\/linkeddata\.cultureelerfgoed\.nl\/graph\/werelderfgoed_hvdl>/);
  assert.match(query, /ceo:heeftWerelderfgoedType\/skos:prefLabel/);
  assert.match(query, /ceo:jaarVanInschrijving/);
  assert.match(query, /ceo:wordtGetoondOp/);
  assert.match(query, /schokland/);
  // Geen SUBSTR-afkapping meer: een voorvoegsel van een meerdelige polygon
  // (zoals de Waddenzee) mist willekeurig welke delen wktToLatLng() nodig
  // heeft om de dominante ring te kiezen.
  assert.match(query, /\(SAMPLE\(STR\(\?wktValue\)\) AS \?wkt\)/);
  assert.doesNotMatch(query, /SUBSTR/);
});

test("drops the naam-FILTER in the Werelderfgoed query when browsing without a term", () => {
  // Browsen (alle 18 tonen) is geen tekstzoekopdracht: zonder term moet de
  // FILTER helemaal wegvallen in plaats van op een lege string te matchen.
  const query = buildWerelderfgoedQuery("");
  assert.doesNotMatch(query, /FILTER/);
});

test("escapes the search term in the Werelderfgoed query", () => {
  const query = buildWerelderfgoedQuery('Schokland" . ?s ?p ?o #');
  assert.match(query, /schokland\\" \. \?s \?p \?o #/);
});

test("parses Werelderfgoed results into RceMonument-shaped records", () => {
  const document = { results: { bindings: [{
    cho: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/werelderfgoed/10134679" },
    choi: { value: "10134679" },
    wenr: { value: "739" },
    naam: { value: "Schokland" },
    type: { value: "archeologie" },
    registratiedatum: { value: "1995-12-31" },
    jaar: { value: "1995" },
    url: { value: "https://whc.unesco.org/en/list/739" },
    wkt: { value: "Point (5.75 52.65)" },
  }] } };
  const [werelderfgoed] = parseWerelderfgoedResults(document);
  assert.equal(werelderfgoed.choNumber, "10134679");
  assert.equal(werelderfgoed.monumentNumber, "739");
  assert.equal(werelderfgoed.name, "Schokland");
  assert.equal(werelderfgoed.monumentNature, "werelderfgoed");
  assert.equal(werelderfgoed.description, "Archeologie. Op de Werelderfgoedlijst sinds 1995.");
  assert.equal(werelderfgoed.officialUrl, "https://whc.unesco.org/en/list/739");
  assert.equal(werelderfgoed.lat, 52.65);
  assert.equal(werelderfgoed.lng, 5.75);
});

test("looks up Gezicht across both graphs, filtered to the rijksbeschermd status", () => {
  // Van de 482 Gezicht-instanties zijn er maar 472 daadwerkelijk
  // rijksbeschermd; de rest is ingetrokken of nog in procedure en hoort
  // niet in de zoekresultaten, net zoals introkken Rijksmonumenten.
  const query = buildGezichtQuery("Orvelte");
  assert.match(query, /a ceo:Gezicht/);
  assert.match(query, /ceo:heeftGezichtsstatus <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/rn\/2\/fd968529-bf70-4afa-8564-7c6c2fcfcc54>/);
  assert.match(query, new RegExp(`GRAPH <${RCE_SEMANTICS.instancesGraph}>`));
  assert.match(query, /GRAPH <https:\/\/linkeddata\.cultureelerfgoed\.nl\/graph\/gezicht_hvdl>/);
  assert.match(query, /ceo:wordtGetoondOp/);
  assert.match(query, /orvelte/);
});

test("drops the naam-FILTER in the Gezicht query when browsing without a term", () => {
  const query = buildGezichtQuery("");
  assert.doesNotMatch(query, /FILTER/);
  // De heeftGezichtsstatus-restrictie moet blijven staan: browsen betekent
  // alle 472 rijksbeschermde gezichten, niet alle 482 (incl. ingetrokken).
  assert.match(query, /ceo:heeftGezichtsstatus/);
});

test("escapes the search term in the Gezicht query", () => {
  const query = buildGezichtQuery('Orvelte" . ?s ?p ?o #');
  assert.match(query, /orvelte\\" \. \?s \?p \?o #/);
});

test("parses Gezicht results into RceMonument-shaped records", () => {
  const document = { results: { bindings: [{
    cho: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/gezicht/10134178" },
    choi: { value: "10134178" },
    gnr: { value: "1325" },
    naam: { value: "Orvelte" },
    registratiedatum: { value: "1967-08-07" },
    url: { value: "https://archisarchief.cultureelerfgoed.nl/Beschermde_Gezichten/BG1325" },
    wkt: { value: "Point (6.65 52.85)" },
  }] } };
  const [gezicht] = parseGezichtResults(document);
  assert.equal(gezicht.choNumber, "10134178");
  assert.equal(gezicht.monumentNumber, "1325");
  assert.equal(gezicht.name, "Orvelte");
  assert.equal(gezicht.monumentNature, "gezicht");
  assert.equal(gezicht.description, "Rijksbeschermd stads- of dorpsgezicht.");
  assert.equal(gezicht.officialUrl, "https://archisarchief.cultureelerfgoed.nl/Beschermde_Gezichten/BG1325");
  assert.equal(gezicht.lat, 52.85);
  assert.equal(gezicht.lng, 6.65);
});
