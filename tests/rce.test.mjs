import assert from "node:assert/strict";
import test from "node:test";
import { buildAbrTermSuggestQuery, buildArcheologischOnderzoekDetailsQuery, buildArcheologischOnderzoekDiscoveryQueries, buildArcheologischTerreinQuery, buildChtTermSuggestQuery, buildComplexenQuery, buildComplexMembersQuery, buildComplexQuery, buildGezichtQuery, buildGroenaanlegQuery, buildImageQuery, buildOnderzoeksgebiedAggregatenQuery, buildOnderzoeksgebiedComplexenQuery, buildOnderzoeksgebiedVondstlocatiesQuery, buildRceDiscoveryQueries, buildRceFacetsQuery, buildRceNumberQuery, buildRceParcelQuery, buildWerelderfgoedQuery, mergeDiscoveryMatches, parseAbrTermSuggestResults, parseArcheologischOnderzoekDiscoveryResults, parseArcheologischOnderzoekResults, parseArcheologischTerreinResults, parseChtTermSuggestResults, parseComplexenResults, parseComplexMembersResults, parseComplexResults, parseDiscoveryBranchResults, parseGezichtResults, parseGroenaanlegResults, parseImageResults, parseOnderzoeksgebiedAggregatenResults, parseOnderzoeksgebiedComplexenResults, parseOnderzoeksgebiedVondstlocatiesResults, parseParcelResults, parseRceMonuments, parseSparqlResults, parseWerelderfgoedResults, parseWktGeometry, provinceName, RCE_SEMANTICS } from "../lib/rce.ts";

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

test("parses a Point into structured geometry", () => {
  assert.deepEqual(parseWktGeometry("Point (5.1267842049703 52.088895166661)"), { kind: "point", lng: 5.1267842049703, lat: 52.088895166661 });
});

test("parses a Polygon into its exterior ring", () => {
  const geometry = parseWktGeometry("Polygon ((5.0 52.0, 5.0 52.2, 5.2 52.2, 5.2 52.0))");
  assert.deepEqual(geometry, { kind: "polygon", rings: [[[5.0, 52.0], [5.0, 52.2], [5.2, 52.2], [5.2, 52.0]]] });
});

test("parses a Polygon with a hole into two separate rings", () => {
  // Zonder deze scheiding zou de kaart het gat opvullen in plaats van
  // uitsparen - de tweede ring hoort bij dezelfde polygon, niet bij een
  // los deelgebied.
  const geometry = parseWktGeometry("Polygon ((0 0, 0 10, 10 10, 10 0), (2 2, 2 4, 4 4, 4 2))");
  assert.equal(geometry.kind, "polygon");
  assert.equal(geometry.rings.length, 2);
  assert.deepEqual(geometry.rings[0], [[0, 0], [0, 10], [10, 10], [10, 0]]);
  assert.deepEqual(geometry.rings[1], [[2, 2], [2, 4], [4, 4], [4, 2]]);
});

test("parses a MultiPolygon into separate polygons, each with their own rings", () => {
  const wkt = "MultiPolygon (((5.0 53.0, 5.0 53.2, 7.0 53.2, 7.0 53.0)), ((50.0 10.0, 50.0 10.01, 50.01 10.01, 50.01 10.0)))";
  const geometry = parseWktGeometry(wkt);
  assert.equal(geometry.kind, "multipolygon");
  assert.equal(geometry.polygons.length, 2);
  assert.deepEqual(geometry.polygons[0], [[[5.0, 53.0], [5.0, 53.2], [7.0, 53.2], [7.0, 53.0]]]);
  assert.deepEqual(geometry.polygons[1], [[[50.0, 10.0], [50.0, 10.01], [50.01, 10.01], [50.01, 10.0]]]);
});

test("returns undefined for unrecognized WKT", () => {
  assert.equal(parseWktGeometry("LineString (0 0, 1 1)"), undefined);
  assert.equal(parseWktGeometry(""), undefined);
});

test("returns undefined for WKT variants outside the supported RCE profile", () => {
  // Doorzoeker ondersteunt bewust alleen Point/Polygon/MultiPolygon in
  // lng/lat, zoals de RCE-data die daadwerkelijk levert. Dit vergrendelt die
  // grens: als RCE ooit een van deze varianten gaat leveren, faalt deze test
  // zichtbaar in plaats van dat de kaart stilzwijgend verkeerd gaat renderen.
  assert.equal(parseWktGeometry("SRID=4326;POINT (5 52)"), undefined);
  assert.equal(parseWktGeometry("POINT Z (5 52 0)"), undefined);
  assert.equal(parseWktGeometry("GEOMETRYCOLLECTION (POINT (5 52))"), undefined);
  assert.equal(parseWktGeometry("POLYGON EMPTY"), undefined);
});

test("does not throw on malformed or garbage WKT", () => {
  // Geen enkele van deze invoer mag de applicatie laten crashen, ook al is
  // het resultaat voor sommige daarvan geen bruikbare geometrie.
  assert.doesNotThrow(() => parseWktGeometry("Polygon ((1 2, 3 4)"));
  assert.doesNotThrow(() => parseWktGeometry("Polygon((((("));
  assert.doesNotThrow(() => parseWktGeometry("MultiPolygon ()"));
  assert.doesNotThrow(() => parseWktGeometry("volstrekte onzin"));
  assert.doesNotThrow(() => parseWktGeometry("Point ()"));
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

test("looks up Complexen by naam and derives a kaartpositie from the hoofdobject's geometrie", () => {
  // Een Complex heeft geen eigen geometrie - het is een samenhang tussen
  // rijksmonumenten, geen ruimtelijk object zelf. Het hoofdobject (het
  // bepalende monument van het complex) levert de kaartpositie.
  const query = buildComplexenQuery("Rijnoord");
  assert.match(query, /a ceo:Complex/);
  assert.match(query, /ceo:heeftRijksmonument \?lidValue/);
  assert.match(query, /ceo:heeftHoofdobject \?hoofdobjectValue/);
  assert.match(query, /\?hoofdobjectValue ceo:heeftGeometrie\/geo:asWKT \?wktValue/);
  assert.match(query, /rijnoord/);
});

test("drops the naam-FILTER in the Complexen query when browsing without a term", () => {
  const query = buildComplexenQuery("");
  assert.doesNotMatch(query, /FILTER/);
});

test("escapes the search term in the Complexen query", () => {
  const query = buildComplexenQuery('Rijnoord" . ?s ?p ?o #');
  assert.match(query, /rijnoord\\" \. \?s \?p \?o #/);
});

test("parses Complexen results into RceMonument-shaped records", () => {
  const document = { results: { bindings: [{
    complex: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/complex/531014" },
    choi: { value: "531014" },
    complexnummer: { value: "531014" },
    naam: { value: "Rijnoord" },
    registratiedatum: { value: "1998-06-15" },
    wkt: { value: "Point (5.9 51.95)" },
    aantalLeden: { value: "3" },
  }] } };
  const [complex] = parseComplexenResults(document);
  assert.equal(complex.choNumber, "531014");
  assert.equal(complex.monumentNumber, "531014");
  assert.equal(complex.name, "Rijnoord");
  assert.equal(complex.monumentNature, "complex");
  assert.equal(complex.complexMemberCount, 3);
  assert.equal(complex.description, "Complex van 3 rijksmonumenten.");
  assert.equal(complex.lat, 51.95);
  assert.equal(complex.lng, 5.9);
});

test("falls back to a generic omschrijving when a Complex has no formele omschrijving", () => {
  const document = { results: { bindings: [{ complex: { value: "c:1" }, choi: { value: "1" }, complexnummer: { value: "1" }, aantalLeden: { value: "1" } }] } };
  const [complex] = parseComplexenResults(document);
  assert.equal(complex.description, "Complex van 1 rijksmonument.");
});

test("looks up a representative beeldbank-foto by rijksmonumentnummer", () => {
  // De afbeelding zelf draagt het rijksmonumentnummer - geen CHO-URI-omweg
  // nodig zoals bij archeologische terreinen/complexen.
  const query = buildImageQuery(["36046", "45708"]);
  assert.match(query, /\?image ceo:rijksmonumentnummer \?rmnr/);
  assert.match(query, /foaf:depiction \?depictionValue/);
  assert.match(query, /dc:rights \?rightsValue/);
  assert.match(query, /edm:isShownAt \?shownAtValue/);
  assert.match(query, /"36046" "45708"/);
});

test("parses image results, skipping monuments without a usable depiction URL", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "36046" }, depiction: { value: "https://images.memorix.nl/rce/thumb/640x480/abc.jpg" }, title: { value: "Voorgevel" }, rights: { value: "https://creativecommons.org/licenses/by/4.0/" }, shownAt: { value: "https://beeldbank.cultureelerfgoed.nl/x" } },
    { rmnr: { value: "45708" } },
  ] } };
  const byNumber = parseImageResults(document);
  assert.deepEqual(byNumber.get("36046"), { url: "https://images.memorix.nl/rce/thumb/640x480/abc.jpg", title: "Voorgevel", license: "https://creativecommons.org/licenses/by/4.0/", sourceUrl: "https://beeldbank.cultureelerfgoed.nl/x" });
  assert.equal(byNumber.has("45708"), false);
});

test("looks up groenaanleg-classificatie by the monument's own CHO subject URI", () => {
  const query = buildGroenaanlegQuery(["https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/65314"]);
  assert.match(query, /ceo:heeftTypeAanleg\/skos:prefLabel/);
  assert.match(query, /ceo:heeftCategorieGroenaanleg\/skos:prefLabel/);
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/65314>/);
});

test("parses groenaanleg results, skipping monuments with neither type nor categorie", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, type: { value: "formele tuin" }, categorie: { value: "aanleg" } },
    { rm: { value: "rm:2" } },
  ] } };
  const byMonument = parseGroenaanlegResults(document);
  assert.deepEqual(byMonument.get("rm:1"), { typeAanleg: "formele tuin", categorie: "aanleg" });
  assert.equal(byMonument.has("rm:2"), false);
});

test("looks up complex members by the complex's own CHO subject URI", () => {
  const query = buildComplexMembersQuery("https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/complex/64690");
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/complex\/64690> ceo:heeftRijksmonument \?rm/);
  assert.match(query, /ceo:heeftHoofdobject \?hoofdobjectValue/);
  assert.match(query, /\?rm ceo:heeftGeometrie\/geo:asWKT \?wktValue/);
});

test("parses complex members and marks the hoofdobject", () => {
  // Geverifieerd tegen "Bio Herstellingsoord" (complex/64690, complexnummer
  // 532181): 7 leden, elk met eigen naam en geometrie.
  const document = { results: { bindings: [
    { rm: { value: "rm:71090" }, rmnr: { value: "532188" }, naam: { value: "Mytylschool" }, hoofdobject: { value: "rm:71096" } },
    { rm: { value: "rm:71096" }, rmnr: { value: "532182" }, naam: { value: "Hoofdgebouw" }, hoofdobject: { value: "rm:71096" } },
  ] } };
  const members = parseComplexMembersResults(document);
  assert.deepEqual(members, [
    { choUri: "rm:71090", monumentNumber: "532188", name: "Mytylschool", isHoofdobject: false, wkt: undefined, lat: undefined, lng: undefined },
    { choUri: "rm:71096", monumentNumber: "532182", name: "Hoofdgebouw", isHoofdobject: true, wkt: undefined, lat: undefined, lng: undefined },
  ]);
});

test("parses each complex member's own geometrie, so a complex can be drawn as the union of its members' polygonen", () => {
  // Dit is de kern van taak #7: een complex is een samenraapsel van
  // zelfstandige monumenten, dus "de vorm van het complex" moet uit de
  // eigen geometrie van elk lid komen, niet uit één gemiddelde of alleen
  // die van het hoofdobject.
  const document = { results: { bindings: [
    { rm: { value: "rm:71090" }, rmnr: { value: "532188" }, naam: { value: "Mytylschool" }, wkt: { value: "Point (5.9 51.95)" } },
  ] } };
  const [member] = parseComplexMembersResults(document);
  assert.equal(member.wkt, "Point (5.9 51.95)");
  assert.equal(member.lat, 51.95);
  assert.equal(member.lng, 5.9);
});

test("falls back to functie or a generic label when a complex member has no naam", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, rmnr: { value: "532183" }, functie: { value: "Ketelhuis" } },
    { rm: { value: "rm:2" }, rmnr: { value: "532184" } },
  ] } };
  const members = parseComplexMembersResults(document);
  assert.equal(members[0].name, "Ketelhuis");
  assert.equal(members[1].name, "Rijksmonument 532184");
});

test("discovers archeologische onderzoeksgebieden via woonplaats and omschrijving as separate branches", () => {
  // ArcheologischOnderzoeksgebied heeft geen naam/registernummer en is met
  // 112K instanties te groot voor een enkele CONTAINS-query over de hele
  // collectie (zoals Werelderfgoed/Gezicht/Complex dat wel kunnen) - vandaar
  // hetzelfde per-branch-patroon als de Rijksmonument-discovery.
  const queries = buildArcheologischOnderzoekDiscoveryQueries("Nijmegen");
  assert.deepEqual(queries.map((q) => q.bron), ["woonplaats (onderzoeksgebied)", "omschrijving (onderzoeksgebied)"]);
  for (const { query } of queries) {
    assert.match(query, /a ceo:ArcheologischOnderzoeksgebied/);
    assert.match(query, /nijmegen/i);
    assert.doesNotMatch(query, /UNION/);
  }
  const woonplaats = queries.find((q) => q.bron === "woonplaats (onderzoeksgebied)").query;
  assert.match(woonplaats, /ceo:heeftBasisregistratieRelatie\/ceo:heeftBAGRelatie\/ceo:woonplaatsnaam \?match/);
  const omschrijving = queries.find((q) => q.bron === "omschrijving (onderzoeksgebied)").query;
  assert.match(omschrijving, /ceo:heeftOmschrijving\/ceo:omschrijving \?match/);
});

test("parses archeologisch-onderzoek discovery matches keyed by cultuurhistorischObjectnummer", () => {
  const document = { results: { bindings: [{ choi: { value: "10000040" }, match: { value: "Nijmegen" } }] } };
  const matches = parseArcheologischOnderzoekDiscoveryResults(document, "woonplaats (onderzoeksgebied)", "nijmegen");
  assert.deepEqual(matches, [{ monumentNumber: "10000040", matchSource: "woonplaats (onderzoeksgebied)", matchedText: "Nijmegen", matchScore: 10 }]);
});

test("builds a details query for archeologische onderzoeksgebieden keyed by cultuurhistorischObjectnummer", () => {
  const query = buildArcheologischOnderzoekDetailsQuery(["10000040"]);
  assert.match(query, /a ceo:ArcheologischOnderzoeksgebied/);
  assert.match(query, /VALUES \?choi \{ "10000040" \}/);
  assert.match(query, /ceo:heeftGeometrie\/geo:asWKT \?wktValue/);
});

test("parses archeologisch-onderzoek details into RceMonument-shaped records", () => {
  // Geverifieerd tegen echte data: onderzoeksgebied 10000040 (Nijmegen).
  const document = { results: { bindings: [{
    gebied: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/10000040" },
    choi: { value: "10000040" },
    omschrijving: { value: "Proefsleuvenonderzoek voorafgaand aan nieuwbouw." },
    woonplaats: { value: "Nijmegen" },
    registratiedatum: { value: "2015-05-26" },
    wkt: { value: "Polygon ((5.86 51.84, 5.87 51.84, 5.87 51.85, 5.86 51.84))" },
  }] } };
  const [gebied] = parseArcheologischOnderzoekResults(document);
  assert.equal(gebied.choNumber, "10000040");
  assert.equal(gebied.monumentNumber, "10000040");
  assert.equal(gebied.monumentNature, "archeologischonderzoeksgebied");
  assert.equal(gebied.description, "Proefsleuvenonderzoek voorafgaand aan nieuwbouw.");
  assert.equal(gebied.place, "Nijmegen");
  assert.equal(gebied.municipality, "Nijmegen");
  assert.ok(gebied.wkt.startsWith("Polygon"));
});

test("falls back to a generic omschrijving when an onderzoeksgebied has no omschrijving", () => {
  const document = { results: { bindings: [{ gebied: { value: "g:1" }, choi: { value: "1" } }] } };
  const [gebied] = parseArcheologischOnderzoekResults(document);
  assert.equal(gebied.description, "Archeologisch onderzoeksgebied.");
});

test("looks up archeologische complexen rechtstreeks onder een onderzoeksgebied", () => {
  // ArcheologischComplex heeft geen naam/complexnummer (anders dan het
  // gewone Complex-type) - alleen een cultuurhistorischObjectnummer en een
  // type-classificatie, geverifieerd tegen echte data ("Terp/wierde").
  const gebiedUri = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/10000040";
  const query = buildOnderzoeksgebiedComplexenQuery(gebiedUri);
  assert.match(query, new RegExp(`<${gebiedUri}> ceo:bevatObject \\?complex`));
  assert.match(query, /a ceo:ArcheologischComplex/);
  assert.match(query, /ceo:heeftType\/ceo:heeftTypeNaam\/skos:prefLabel/);
});

test("parses onderzoeksgebied-complexen, falling back to a generic label without a typeLabel", () => {
  const document = { results: { bindings: [
    { complex: { value: "c:1" }, choi: { value: "2122057" }, typeLabel: { value: "Terp/wierde" } },
    { complex: { value: "c:2" }, choi: { value: "2122058" } },
  ] } };
  const complexen = parseOnderzoeksgebiedComplexenResults(document);
  assert.deepEqual(complexen, [
    { complexUri: "c:1", choNumber: "2122057", typeLabel: "Terp/wierde" },
    { complexUri: "c:2", choNumber: "2122058", typeLabel: undefined },
  ]);
});

test("caps de vondstlocaties-lijst van een onderzoeksgebied op 25", () => {
  // Het grootste geobserveerde onderzoeksgebied bevat 2.191 vondstlocaties -
  // een LIMIT is dus geen theoretische voorzorg.
  const query = buildOnderzoeksgebiedVondstlocatiesQuery("g:1");
  assert.match(query, /LIMIT 25/);
  assert.match(query, /a ceo:Vondstlocatie/);
});

test("parses vondstlocaties, treating a bare '-' locatienaam as missing", () => {
  const document = { results: { bindings: [
    { vl: { value: "vl:1" }, choi: { value: "1" }, locatienaam: { value: "Afferden" } },
    { vl: { value: "vl:2" }, choi: { value: "2" }, locatienaam: { value: "-" } },
  ] } };
  const vondstlocaties = parseOnderzoeksgebiedVondstlocatiesResults(document);
  assert.equal(vondstlocaties[0].locatienaam, "Afferden");
  assert.equal(vondstlocaties[1].locatienaam, undefined);
});

test("builds an aggregate-only query for grondsporen/vondsten/complexen under an onderzoeksgebied", () => {
  // Bewust geen lijst: het grootste onderzoeksgebied levert 7.750 vondsten en
  // 3.458 complexen op via zijn vondstlocaties - een lijst zou onbruikbaar
  // zijn, een aggregaattelling blijft altijd goedkoop.
  const query = buildOnderzoeksgebiedAggregatenQuery("g:1");
  assert.match(query, /COUNT\(DISTINCT \?vl\) AS \?vondstlocatieTotaal/);
  assert.match(query, /COUNT\(\?grondspoor\) AS \?grondsporenTotaal/);
  assert.match(query, /COUNT\(\?vondst\) AS \?vondstenTotaal/);
  assert.match(query, /COUNT\(DISTINCT \?complexViaVl\) AS \?complexenViaVondstlocatieTotaal/);
});

test("parses onderzoeksgebied-aggregaten", () => {
  const document = { results: { bindings: [{
    vondstlocatieTotaal: { value: "2191" },
    grondsporenTotaal: { value: "0" },
    vondstenTotaal: { value: "7750" },
    complexenViaVondstlocatieTotaal: { value: "3458" },
  }] } };
  assert.deepEqual(parseOnderzoeksgebiedAggregatenResults(document), {
    vondstlocatieTotaal: 2191, grondsporenTotaal: 0, vondstenTotaal: 7750, complexenViaVondstlocatieTotaal: 3458,
  });
});

test("treats a missing binding (geen vondstlocaties) as all-zero aggregaten, not a crash", () => {
  const document = { results: { bindings: [] } };
  assert.deepEqual(parseOnderzoeksgebiedAggregatenResults(document), {
    vondstlocatieTotaal: 0, grondsporenTotaal: 0, vondstenTotaal: 0, complexenViaVondstlocatieTotaal: 0,
  });
});

test("queries the CHT-thesaurus rechtstreeks voor termsuggesties, met de materialen/stijlen-hoofdtakken als losse markering", () => {
  // Referentienetwerk (RCE's eigen CHT/ABR-thesauri) is de brondata; het
  // externe Termennetwerk is slechts een doorgeefluik daarvan. Voor een
  // RCE-specifieke app als Doorzoeker is die omweg overbodig - vandaar
  // rechtstreeks tegen dezelfde SPARQL-dienst als de rest van de app.
  const query = buildChtTermSuggestQuery("woonhuis", 8);
  assert.match(query, /GRAPH <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/cht\/thesaurus>/);
  assert.match(query, /a skos:Concept ; skos:prefLabel \?label/);
  assert.match(query, /CONTAINS\(LCASE\(STR\(\?label\)\), "woonhuis"\)/);
  assert.match(query, /skos:broader\* <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/cht\/aa872ce6-a74c-4f81-96ec-6ee0e717f92a>/);
  assert.match(query, /skos:broader\* <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/cht\/63cca950-f545-467a-9d70-db3a2b21bba3>/);
  assert.match(query, /LIMIT 8/);
});

test("lowercases and escapes the search term in the CHT-termsuggestiequery", () => {
  const query = buildChtTermSuggestQuery('Woonhuis" . ?s ?p ?o #', 8);
  assert.match(query, /CONTAINS\(LCASE\(STR\(\?label\)\), "woonhuis\\" \. \?s \?p \?o #"\)/);
});

test("parses CHT-termsuggesties, labeling de hoofdtak materialen/stijlen-en-periodes of de generieke thesaurus", () => {
  const document = { results: { bindings: [
    { concept: { value: "cht:1" }, label: { value: "Woonhuis" }, isMateriaal: { value: "false" }, isStijlPeriode: { value: "false" } },
    { concept: { value: "cht:2" }, label: { value: "Utrechtse steen" }, isMateriaal: { value: "true" }, isStijlPeriode: { value: "false" } },
    { concept: { value: "cht:3" }, label: { value: "art deco" }, isMateriaal: { value: "false" }, isStijlPeriode: { value: "true" } },
  ] } };
  assert.deepEqual(parseChtTermSuggestResults(document), [
    { uri: "cht:1", label: "Woonhuis", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus", sourceName: "Cultuurhistorische Thesaurus" },
    { uri: "cht:2", label: "Utrechtse steen", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus", sourceName: "Cultuurhistorische Thesaurus - Materialen" },
    { uri: "cht:3", label: "art deco", sourceUri: "https://data.cultureelerfgoed.nl/term/id/cht/thesaurus", sourceName: "Cultuurhistorische Thesaurus - Stijlen en periodes" },
  ]);
});

test("queries the ABR-thesaurus rechtstreeks voor archeologische vondsttermen", () => {
  const query = buildAbrTermSuggestQuery("aardewerk", 8);
  assert.match(query, /GRAPH <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/abr\/thesaurus>/);
  assert.match(query, /CONTAINS\(LCASE\(STR\(\?label\)\), "aardewerk"\)/);
});

test("parses ABR-termsuggesties met een vaste bronnaam", () => {
  const document = { results: { bindings: [{ concept: { value: "abr:1" }, label: { value: "gladwandig aardewerk" } }] } };
  assert.deepEqual(parseAbrTermSuggestResults(document), [
    { uri: "abr:1", label: "gladwandig aardewerk", sourceUri: "https://data.cultureelerfgoed.nl/term/id/abr/thesaurus", sourceName: "Archeologisch Basisregister" },
  ]);
});
