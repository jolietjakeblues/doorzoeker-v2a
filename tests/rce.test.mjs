import assert from "node:assert/strict";
import test from "node:test";
import { boundingBoxWktLiteral, buildAbrTermSuggestQuery, buildActorConceptQuery, buildArcheologischeComplexConceptQuery, buildArcheologischeComplexDetailsQuery, buildArcheologischeComplexDiscoveryQueries, buildArcheologischeContextExacteQuery, buildArcheologischeContextKandidatenQuery, buildArcheologischeWaarderingConceptQuery, buildArcheologischOnderzoekDetailsQuery, buildArcheologischOnderzoekDiscoveryQueries, buildArcheologischTerreinDetailsQuery, buildArcheologischTerreinDiscoveryQueries, buildArcheologischTerreinQuery, buildBouwkundigeStaatConceptQuery, buildChtTermSuggestQuery, buildRijksmonumentGeometrieQuery, buildStijlConceptQuery, buildComplexenQuery, buildComplexMembersQuery, buildComplexQuery, buildGebeurtenisConceptQuery, buildGebeurtenissenQuery, buildGezichtLidmaatschapQuery, buildGezichtQuery, buildGroenaanlegQuery, buildGrondsporenDetailsQuery, buildGrondsporenDiscoveryQueries, buildGrondspoorTypeConceptQuery, buildImageQuery, buildMonumentAardConceptQuery, buildMonumentTypeConceptQuery, buildMspIndicatieQuery, buildOnderzoeksgebiedAggregatenQuery, buildOnderzoeksgebiedComplexenQuery, buildOnderzoeksgebiedVondstlocatiesQuery, buildOpDezeDagQuery, buildRceChoNumberQuery, buildRceDetailsQuery, buildRceDiscoveryQueries, buildRceFacetsQuery, buildRceParcelsQuery, buildReferentienetwerkTermSuggestQuery, buildVondstlocatieDetailsQuery, buildVondstlocatieDiscoveryQueries, buildVondstlocatieInhoudQuery, buildVondstlocatieInhoudTellingQuery, buildVerwervingConceptQuery, buildVondstenConceptQuery, buildVondstenDetailsQuery, buildVondstenDiscoveryQueries, buildWerelderfgoedLidmaatschapQuery, buildWerelderfgoedQuery, mergeDiscoveryMatches, mergeVondstlocatieInhoud, parseAbrTermSuggestResults, parseArcheologischeComplexDiscoveryResults, parseArcheologischeComplexResults, parseArcheologischeContextKandidaten, parseArcheologischeContextResults, parseArcheologischOnderzoekDiscoveryResults, parseArcheologischOnderzoekResults, parseArcheologischTerreinDiscoveryResults, parseArcheologischTerreinResults, parseChtTermSuggestResults, parseComplexenResults, parseComplexMembersResults, parseComplexResults, parseConceptSearchMatches, parseDiscoveryBranchResults, parseGebeurtenissenResults, parseGezichtLidmaatschapResults, parseGezichtResults, parseGroenaanlegResults, parseGrondsporenDiscoveryResults, parseGrondsporenResults, parseImageResults, parseMspIndicatieResults, parseOnderzoeksgebiedAggregatenResults, parseOnderzoeksgebiedComplexenResults, parseOnderzoeksgebiedVondstlocatiesResults, parseOpDezeDagCandidates, parseParcelResults, parseRceMonuments, parseReferentienetwerkTermSuggestResults, parseRijksmonumentGeometrieResult, parseSparqlResults, parseStandaloneArcheologischTerreinResults, parseVondstlocatieDiscoveryResults, parseVondstlocatieInhoudResults, parseVondstlocatieInhoudTelling, parseVondstlocatieResults, parseVondstenDiscoveryResults, parseVondstenResults, parseWerelderfgoedLidmaatschapResults, parseWerelderfgoedResults, parseWktGeometry, pickOpDezeDagCandidate, provinceName, RCE_SEMANTICS, VONDSTLOCATIE_INHOUD_KLASSEN, wktToLatLng } from "../lib/rce.ts";
import { buildArchaeologyBrowseQuery, buildRijksmonumentenBrowseQuery, parseArchaeologyBrowseNumbers, parseRijksmonumentenBrowseNumbers } from "../lib/rce.ts";
import { buildFunctieConceptQuery, buildTermUsageQuery, parseFacetResults, parseTermUsageResults } from "../lib/rce.ts";

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
  assert.deepEqual(parseSparqlResults(document), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "", houseNumber: "", postalCode: "3512KM", sourceUrl: "rm:38342", name: undefined, functionName: "Woonhuis(K)", originalFunctionNames: [], currentFunctionNames: [], typeNames: [], legalStatus: "rijksmonument", description: "Pand met 17e eeuwse lijstgevel.", monumentNature: "onroerend gebouwd", monumentAardConceptUri: undefined, fullAddress: "Brigittenstraat 18", place: "Utrecht", municipality: undefined, provinceCode: undefined, lng: 5.1267842049703, lat: 52.088895166661, wkt: "Point (5.1267842049703 52.088895166661)", stijlEnCultuur: undefined, stijlEnCultuurConceptUri: undefined, bouwkundigeStaat: undefined, bouwkundigeStaatConceptUri: undefined }]);
});

test("captures the monumentaard concept-URI alongside its label", () => {
  // Referentienetwerk-integratie (taak #10, eerste schijf): naast het label
  // ("onroerend gebouwd") moet ook de concept-URI meekomen waarmee het
  // record zelf is geclassificeerd, zodat de UI daarop exact kan doorzoeken.
  const document = { results: { bindings: [{ rmnr: { value: "36046" }, monumentaard: { value: "onroerend gebouwd" }, monumentaardConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.monumentNature, "onroerend gebouwd");
  assert.equal(monument.monumentAardConceptUri, "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21");
});

test("builds an exact-match query on a monumentaard concept-URI instead of a label", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/fc966a68-8863-4970-a83e-110f96006c21";
  const query = buildMonumentAardConceptQuery(uri);
  assert.match(query, new RegExp(`ceo:heeftMonumentAard <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("builds an exact-match query on an archeologische-waardering concept-URI, op het eigen CHO-nummer van het terrein (P1: 86% van de terreinen heeft geen ligtInObject-koppeling)", () => {
  // Live geverifieerd (15 augustus 2026): van de ~13.018 ArcheologischTerrein-
  // instanties met een waardering hebben er maar ~1.812 (~14%) een
  // ceo:ligtInObject-relatie naar een Rijksmonument. De oudere queryvorm
  // (via ligtInObject naar een rijksmonumentnummer) liet de overige ~86%
  // stilzwijgend 0 resultaten opleveren bij een klik op hun eigen
  // waardering-label - zie CHO 6042545 (heeft heeftArcheologischeWaardering,
  // geen ligtInObject).
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/31020cd0-9029-4609-bbd8-ee83f9baf3f4";
  const query = buildArcheologischeWaarderingConceptQuery(uri);
  assert.match(query, /a ceo:ArcheologischTerrein/);
  assert.match(query, /ceo:cultuurhistorischObjectnummer \?rmnr/);
  assert.match(query, new RegExp(`ceo:heeftArcheologischeWaardering <${uri.replaceAll(".", "\\.")}>`));
  assert.doesNotMatch(query, /ligtInObject/);
  assert.match(query, /LIMIT 100/);
});

test("captures the stijl-en-cultuur and bouwkundige-staat concept-URI's alongside their labels", () => {
  const document = { results: { bindings: [{ rmnr: { value: "36046" }, stijl: { value: "Neo-Renaissance" }, stijlConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/478ca85b-ecb3-4a38-8b97-ba78deeba3dd" }, bouwkundigeStaat: { value: "goed" }, bouwkundigeStaatConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/ed0abe81-4466-44c3-a8c4-2f1a0e63176d" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.stijlEnCultuur, "Neo-Renaissance");
  assert.equal(monument.stijlEnCultuurConceptUri, "https://data.cultureelerfgoed.nl/term/id/rn/2/478ca85b-ecb3-4a38-8b97-ba78deeba3dd");
  assert.equal(monument.bouwkundigeStaat, "goed");
  assert.equal(monument.bouwkundigeStaatConceptUri, "https://data.cultureelerfgoed.nl/term/id/rn/2/ed0abe81-4466-44c3-a8c4-2f1a0e63176d");
});

test("builds an exact-match query on a stijl-en-cultuur concept-URI", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/478ca85b-ecb3-4a38-8b97-ba78deeba3dd";
  const query = buildStijlConceptQuery(uri);
  assert.match(query, /ceo:heeftStijlEnCultuur \?stijlNode/);
  assert.match(query, /ceo:formeelStandpunt true/);
  assert.match(query, new RegExp(`ceo:heeftStijlEnCultuurNaam <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("builds an exact-match query on a bouwkundige-staat concept-URI", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/ed0abe81-4466-44c3-a8c4-2f1a0e63176d";
  const query = buildBouwkundigeStaatConceptQuery(uri);
  assert.match(query, /ceo:heeftBouwkundigeKwaliteit \?kwaliteitNode/);
  assert.match(query, /ceo:formeelStandpunt true/);
  assert.match(query, new RegExp(`ceo:heeftBouwkundigeStaat <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("parses concept-search matches (monumentaard or waardering) into a plain list of rijksmonumentnummers", () => {
  const document = { results: { bindings: [{ rmnr: { value: "36046" } }, { rmnr: { value: "45708" } }] } };
  assert.deepEqual(parseConceptSearchMatches(document), ["36046", "45708"]);
  assert.deepEqual(parseConceptSearchMatches({ results: { bindings: [] } }), []);
  assert.deepEqual(parseConceptSearchMatches({}), []);
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

test("wktToLatLng crasht niet op een zeer grote ring (TD-18)", () => {
  // Sommige Werelderfgoed-polygonen (Waddenzee, Hollandse Waterlinies) zijn
  // megabytes aan WKT met veel meer coördinaten dan dit. Math.max(...lngs)/
  // Math.min(...lngs) met spread-argumenten crasht V8 al bij 200.000
  // getallen (RangeError: Maximum call stack size exceeded, geverifieerd
  // met de node-versie van deze testsuite) - deze test reproduceert die
  // schaal zonder een megabyte-string in de repository op te nemen.
  const pointCount = 200_000;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const fraction = index / pointCount;
    return `${(5 + fraction * 0.1).toFixed(6)} ${(52 + fraction * 0.1).toFixed(6)}`;
  }).join(", ");
  let result;
  assert.doesNotThrow(() => { result = wktToLatLng(`Polygon ((${points}))`); });
  assert.ok(result);
  assert.ok(Number.isFinite(result.lat));
  assert.ok(Number.isFinite(result.lng));
});

test("leaves lat/lng undefined when there is no geometry at all", () => {
  const document = { results: { bindings: [{ rmnr: { value: "1" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.lat, undefined);
  assert.equal(monument.lng, undefined);
});

test("queries and parses BRK parcels separately", () => {
  const query = buildRceParcelsQuery(["36046"]);
  assert.match(query, /ceo:heeftBRKRelatie/);
  assert.doesNotMatch(query, /ceo:heeftBAGRelatie/);
  const document = { results: { bindings: [{ rmnr: { value: "36046" }, gemeente: { value: "Utrecht" }, gemeentecode: { value: "996" }, sectie: { value: "B" }, perceel: { value: "358" }, provinciecode: { value: "UT" } }] } };
  assert.deepEqual(parseParcelResults(document), [{ municipality: "Utrecht", municipalityCode: "996", section: "B", parcelNumber: "358", provinceCode: "UT" }]);
});

test("escapes monument numbers in BRK parcel queries", () => {
  const query = buildRceParcelsQuery(['36046" . ?subject ?predicate ?object #']);
  assert.match(query, /36046\\" \. \?subject \?predicate \?object #/);
  assert.doesNotMatch(query, /VALUES \?rmnr \{ "36046" \. \?subject/);
});

test("only queries formally established descriptions", () => {
  const query = buildRceDetailsQuery(["36046"]);
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

test("queries stijl & cultuur and bouwkundige kwaliteit as formally established facts, with their concept-URI's", () => {
  // De concept-URI (niet alleen het label) moet los meekomen zodat de UI
  // hierop kan doorklikken, net als monumentaard.
  const query = buildRceDetailsQuery(["36046"]);
  assert.match(query, /ceo:heeftStijlEnCultuur \?stijlNode/);
  assert.match(query, /\?stijlNode ceo:formeelStandpunt true ; ceo:heeftStijlEnCultuurNaam \?stijlConceptValue/);
  assert.match(query, /\?stijlConceptValue skos:prefLabel \?stijlValue/);
  assert.match(query, /ceo:heeftBouwkundigeKwaliteit \?kwaliteitNode/);
  assert.match(query, /\?kwaliteitNode ceo:formeelStandpunt true ; ceo:heeftBouwkundigeStaat \?bouwkundigeStaatConceptValue/);
  assert.match(query, /\?bouwkundigeStaatConceptValue skos:prefLabel \?bouwkundigeStaatValue/);
});

test("leaves stijl en cultuur / bouwkundige staat undefined when a Rijksmonument has neither", () => {
  const document = { results: { bindings: [{ rmnr: { value: "36046" } }] } };
  const [monument] = parseSparqlResults(document);
  assert.equal(monument.stijlEnCultuur, undefined);
  assert.equal(monument.bouwkundigeStaat, undefined);
});

test("looks up a Rijksmonument by CHO-nummer, not just rijksmonumentnummer (P1: 71286 gaf 0 resultaten)", () => {
  const query = buildRceChoNumberQuery("71286");
  assert.match(query, /VALUES \?choi \{ "71286" \}/);
  assert.doesNotMatch(query, /VALUES \?rmnr/);
  assert.match(query, new RegExp(`GRAPH <${RCE_SEMANTICS.instancesGraph}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  // Zelfde velden als buildRceDetailsQuery, anders levert een CHO-nummer-match
  // een ander (armer) record op dan een rijksmonumentnummer-match.
  assert.match(query, /ceo:heeftOmschrijving \?omschrijvingNode/);
  assert.match(query, /ceo:heeftBasisregistratieRelatie\/ceo:heeftBAGRelatie \?bag/);
});

test("escapes CHO-nummers in the CHO-nummer lookup query", () => {
  const query = buildRceChoNumberQuery('71286" . ?subject ?predicate ?object #');
  assert.match(query, /71286\\" \. \?subject \?predicate \?object #/);
  assert.doesNotMatch(query, /VALUES \?choi \{ "71286" \. \?subject/);
});

test("queries formal original and current functions as separate facets", () => {
  const query = buildRceFacetsQuery(["36046", "1"]);
  assert.match(query, /ceo:heeftOorspronkelijkeFunctie \?oorspronkelijkeNode/);
  assert.match(query, /ceo:heeftHuidigeFunctie \?huidigeNode/);
  assert.equal((query.match(/ceo:formeelStandpunt true/g) ?? []).length, 3);
  assert.match(query, /ceo:heeftFunctieNaam \?functieConcept/);
  assert.match(query, /STR\(\?functieConcept\)/);
  // Type moet net als functie zowel het label als de concept-URI vastleggen
  // (voorheen alleen /skos:prefLabel via het pad, de URI werd genegeerd -
  // gemeld door de eigenaar: "Type" was geen doorklik).
  assert.match(query, /ceo:heeftType\/ceo:heeftTypeNaam \?typeConcept/);
  assert.match(query, /\?typeConcept skos:prefLabel \?typeNaam/);
  assert.match(query, /CONCAT\(STR\(\?typeConcept\), "~~", STR\(\?typeNaam\)\)/);
});

test("discovers names, addresses, functions, types and descriptions as separate fast queries per source", () => {
  const queries = buildRceDiscoveryQueries('woonhuis "K"');
  assert.deepEqual(queries.map((q) => q.bron), ["oorspronkelijke functie", "huidige functie", "type", "monumentaard", "naam", "formele omschrijving", "volledig adres", "woonplaats"]);
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
  assert.match(queries.find((q) => q.bron === "naam").query, /ceo:heeftNaam\/ceo:naam \?match/);
  assert.match(queries.find((q) => q.bron === "volledig adres").query, /ceo:heeftBAGRelatie\/ceo:volledigAdres \?match/);
});

test("keeps function labels paired with their concept URIs", () => {
  const facets = parseFacetResults({
    results: {
      bindings: [{
        rmnr: { value: "36046" },
        functieConcepten: {
          value: "https://data.cultureelerfgoed.nl/term/id/rn/2/abc~~Woonhuis||https://data.cultureelerfgoed.nl/term/id/rn/2/def~~Museum",
        },
      }],
    },
  });
  assert.deepEqual(facets.get("36046").functionConcepts, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/abc", label: "Woonhuis" },
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/def", label: "Museum" },
  ]);
});

test("keeps type labels paired with their concept URIs (gemeld door de eigenaar: 'Type' was geen doorklik)", () => {
  const facets = parseFacetResults({
    results: {
      bindings: [{
        rmnr: { value: "513195" },
        typen: { value: "Bovenkruier" },
        typeConcepten: {
          value: "https://data.cultureelerfgoed.nl/term/id/rn/2/9ba13642-5aa7-42fa-862f-4b9c71455cce~~Bovenkruier",
        },
      }],
    },
  });
  assert.deepEqual(facets.get("513195").typeNames, ["Bovenkruier"]);
  assert.deepEqual(facets.get("513195").typeConcepts, [
    { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/9ba13642-5aa7-42fa-862f-4b9c71455cce", label: "Bovenkruier" },
  ]);
});

test("builds an exact-match query on een monumenttype-concept-URI", () => {
  // Live geverifieerd (15 augustus 2026, CHO 27601 "Bovenkruier"): matcht
  // meerdere rijksmonumenten met hetzelfde type.
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/9ba13642-5aa7-42fa-862f-4b9c71455cce";
  const query = buildMonumentTypeConceptQuery(uri);
  assert.match(query, /a ceo:Rijksmonument/);
  assert.match(query, new RegExp(`ceo:heeftType/ceo:heeftTypeNaam <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("measures how Referentienetwerk concepts are actually used in CHO", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/woonhuis";
  const query = buildTermUsageQuery([uri]);
  assert.match(query, new RegExp(`<${uri}>`));
  assert.match(query, /heeftOorspronkelijkeFunctie\/ceo:heeftFunctieNaam/);
  assert.match(query, /heeftMateriaal\/ceo:heeftMateriaalNaam/);
  assert.deepEqual(parseTermUsageResults({ results: { bindings: [
    { concept: { value: uri }, field: { value: "functie" }, count: { value: "42" } },
    { concept: { value: uri }, field: { value: "onbekend" }, count: { value: "99" } },
  ] } }).get(uri), { conceptField: "functie", usageCount: 42 });
});

test("builds an exact function search for original and current functions", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/woonhuis";
  const query = buildFunctieConceptQuery(uri);
  assert.match(query, /heeftOorspronkelijkeFunctie\/ceo:heeftFunctieNaam/);
  assert.match(query, /heeftHuidigeFunctie\/ceo:heeftFunctieNaam/);
  assert.equal(query.match(new RegExp(`<${uri}>`, "g"))?.length, 2);
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
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
  // Fase 2 (2026-08-10): de tussenliggende concept-URI wordt nu ook
  // opgehaald (niet meer via een property-path-shortcut die de URI
  // wegmoffelt), zelfde patroon als bij monumentaard.
  assert.match(query, /ceo:heeftArcheologischeWaardering \?waarderingConcept/);
  assert.match(query, /\?waarderingConcept skos:prefLabel \?waarderingLabel/);
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/45708>/);
});

test("captures the archeologische-waardering concept-URI alongside its label", () => {
  const conceptUri = "https://data.cultureelerfgoed.nl/term/id/rn/2/31020cd0-9029-4609-bbd8-ee83f9baf3f4";
  const document = { results: { bindings: [{ rm: { value: "rm:1" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" }, waarderingConcept: { value: conceptUri } }] } };
  const [terrein] = parseArcheologischTerreinResults(document).get("rm:1");
  assert.equal(terrein.waardering, "zeer hoge archeologische waarde beschermd");
  assert.equal(terrein.waarderingConceptUri, conceptUri);
});

test("groups multiple archaeological terreinen under the same monument", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, terrein: { value: "terrein:a" }, archisNummer: { value: "2284" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
    { rm: { value: "rm:1" }, terrein: { value: "terrein:b" }, archisNummer: { value: "1037" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
    { rm: { value: "rm:2" }, terrein: { value: "terrein:c" }, archisNummer: { value: "525" }, waarderingLabel: { value: "zeer hoge archeologische waarde beschermd" } },
  ] } };
  const byMonument = parseArcheologischTerreinResults(document);
  assert.deepEqual(byMonument.get("rm:1"), [
    { archisMonumentnummer: "2284", waardering: "zeer hoge archeologische waarde beschermd", waarderingConceptUri: undefined },
    { archisMonumentnummer: "1037", waardering: "zeer hoge archeologische waarde beschermd", waarderingConceptUri: undefined },
  ]);
  assert.equal(byMonument.get("rm:2").length, 1);
});

test("computes a padded bounding-box WKT literal around a Polygon", () => {
  // Elst-testgeval uit 017-archeologische-context-onderzoeksgebied.md.
  const wkt = "POLYGON((5.849 51.919, 5.850 51.919, 5.850 51.920, 5.849 51.920, 5.849 51.919))";
  const bbox = boundingBoxWktLiteral(wkt, 0.01);
  assert.match(bbox, /^POLYGON\(\(/);
  // Marge zit erin: de bbox-grenzen liggen buiten de oorspronkelijke 5.849-5.850.
  const numbers = [...bbox.matchAll(/(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...numbers) < 5.849);
  assert.ok(Math.max(...numbers) > 5.850);
});

test("computes a bounding-box WKT literal around a Point without crashing on zero-area", () => {
  const bbox = boundingBoxWktLiteral("Point (5.85 51.92)", 0.01);
  assert.match(bbox, /^POLYGON\(\(/);
  const numbers = [...bbox.matchAll(/(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
  const lngs = numbers.filter((_, index) => index % 2 === 0);
  assert.ok(Math.min(...lngs) < 5.85 && Math.max(...lngs) > 5.85);
});

test("returns undefined for an unparseable WKT profile", () => {
  assert.equal(boundingBoxWktLiteral("not wkt", 0.01), undefined);
});

test("builds a query for a Rijksmonument's own geometry, by rijksmonumentnummer", () => {
  const query = buildRijksmonumentGeometrieQuery("14948");
  assert.match(query, /ceo:rijksmonumentnummer "14948"/);
  assert.match(query, /ceo:heeftGeometrie\/geo:asWKT \?wkt/);
});

test("parses the Rijksmonument-geometrie result", () => {
  const document = { results: { bindings: [{ wkt: { value: "Point (5.85 51.92)" } }] } };
  assert.equal(parseRijksmonumentGeometrieResult(document), "Point (5.85 51.92)");
  assert.equal(parseRijksmonumentGeometrieResult({ results: { bindings: [] } }), undefined);
});

test("builds the bbox-voorfilter query for ArcheologischOnderzoeksgebied-kandidaten", () => {
  const query = buildArcheologischeContextKandidatenQuery("POLYGON((5 51, 6 51, 6 52, 5 52, 5 51))");
  assert.match(query, /a ceo:ArcheologischOnderzoeksgebied/);
  assert.match(query, /geof:sfWithin\(\?ogWkt, "POLYGON/);
});

test("parses ArcheologischOnderzoeksgebied-kandidaten as a plain URI list", () => {
  const document = { results: { bindings: [
    { og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204" } },
    { og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2038140" } },
  ] } };
  assert.deepEqual(parseArcheologischeContextKandidaten(document), [
    "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204",
    "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2038140",
  ]);
});

test("builds the exacte-overlap query with the Rijksmonument-WKT embedded and kandidaten in een VALUES-clausule", () => {
  const query = buildArcheologischeContextExacteQuery("Point (5.85 51.92)", [
    "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204",
  ]);
  assert.match(query, /geof:sfOverlaps\("Point \(5\.85 51\.92\)"\^\^geo:wktLiteral, \?ogWkt\)/);
  assert.match(query, /VALUES \?og \{ <https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/archeologischonderzoeksgebied\/2051204> \}/);
  assert.match(query, /ceo:cultuurhistorischObjectnummer/);
  assert.match(query, /ceo:heeftOmschrijving\/ceo:omschrijving/);
  // De geometrie is al nodig voor de geof:sfOverlaps-toets zelf; ook
  // teruggeven kost geen extra aanroep en is nodig om de gevonden
  // Onderzoeksgebieden als polygoon op een kaart te tonen.
  assert.match(query, /\(SAMPLE\(STR\(\?ogWkt\)\) AS \?wkt\)/);
});

test("parses archeologische-context results, met omschrijving als optioneel veld maar wkt als verplicht veld", () => {
  const document = { results: { bindings: [
    {
      og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204" },
      choi: { value: "2051204" },
      omschrijving: { value: "Gallo-Romeins Tempelcomplex 1e en 2e eeuw" },
      wkt: { value: "Point (5.85 51.92)" },
    },
    {
      og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2038140" },
      choi: { value: "2038140" },
      wkt: { value: "Point (5.86 51.93)" },
    },
    {
      // Geen wkt (zou niet moeten voorkomen, want ceo:heeftGeometrie/geo:asWKT
      // is verplicht in de query - defensief toch overgeslagen).
      og: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/9999999" },
      choi: { value: "9999999" },
    },
  ] } };
  assert.deepEqual(parseArcheologischeContextResults(document), [
    { onderzoeksgebiedUri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2051204", choNummer: "2051204", omschrijving: "Gallo-Romeins Tempelcomplex 1e en 2e eeuw", wkt: "Point (5.85 51.92)" },
    { onderzoeksgebiedUri: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/2038140", choNummer: "2038140", omschrijving: undefined, wkt: "Point (5.86 51.93)" },
  ]);
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

test("builds a live per-rijksmonument Gezicht-lidmaatschap query, filtered to the rijksbeschermd status", () => {
  // 006-werelderfgoed-ligt-in.md: dit is de LIVE, lazy per-detail variant
  // (geen offline batch) - fixeert het rijksmonumentnummer en toetst tegen
  // de kleine, vaste Gezicht-kandidatenset via geof:sfWithin.
  const query = buildGezichtLidmaatschapQuery("516161");
  assert.match(query, /ceo:rijksmonumentnummer "516161"/);
  assert.match(query, /a ceo:Gezicht/);
  assert.match(query, /ceo:heeftGezichtsstatus <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/rn\/2\/fd968529-bf70-4afa-8564-7c6c2fcfcc54>/);
  assert.match(query, /geof:sfWithin\(\?rmWkt, \?geWkt\)/);
});

test("escapes the rijksmonumentnummer in the Gezicht-lidmaatschap query", () => {
  const query = buildGezichtLidmaatschapQuery('1" . ?s ?p ?o #');
  assert.match(query, /ceo:rijksmonumentnummer "1\\" \. \?s \?p \?o #"/);
});

test("parses Gezicht-lidmaatschap results, falling back to a generic naam when heeftNaam is missing", () => {
  const document = { results: { bindings: [
    { gnr: { value: "1489" }, naam: { value: "Kinderdijk - Elshout" } },
    { gnr: { value: "9999" } },
  ] } };
  assert.deepEqual(parseGezichtLidmaatschapResults(document), [
    { gezichtsnummer: "1489", naam: "Kinderdijk - Elshout" },
    { gezichtsnummer: "9999", naam: "Gezicht 9999" },
  ]);
});

test("builds a live per-rijksmonument Werelderfgoed-lidmaatschap query", () => {
  const query = buildWerelderfgoedLidmaatschapQuery("516161");
  assert.match(query, /ceo:rijksmonumentnummer "516161"/);
  assert.match(query, /a ceo:Werelderfgoed/);
  assert.match(query, /geof:sfWithin\(\?rmWkt, \?whWkt\)/);
});

test("parses Werelderfgoed-lidmaatschap results, falling back to a generic naam when heeftNaam is missing", () => {
  const document = { results: { bindings: [
    { wenr: { value: "818" }, naam: { value: "Molens bij Kinderdijk-Elshout" } },
    { wenr: { value: "9999" } },
  ] } };
  assert.deepEqual(parseWerelderfgoedLidmaatschapResults(document), [
    { werelderfgoednummer: "818", naam: "Molens bij Kinderdijk-Elshout" },
    { werelderfgoednummer: "9999", naam: "Werelderfgoed 9999" },
  ]);
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

test("looks up groenaanleg-classificatie en -foto by the monument's own CHO subject URI", () => {
  const query = buildGroenaanlegQuery(["https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/65314"]);
  assert.match(query, /ceo:heeftTypeAanleg\/skos:prefLabel/);
  assert.match(query, /ceo:heeftCategorieGroenaanleg\/skos:prefLabel/);
  // Structurele check, niet alleen "komt de substring ergens voor": een
  // eerdere versie zocht edm:isShownBy/foaf:maker rechtstreeks op ?rm, wat
  // live SPARQL-verkenning altijd leeg opleverde - die twee properties
  // staan in werkelijkheid op het losse foaf:depiction-knooppunt, niet op
  // het Rijksmonument zelf. Deze regex faalt dus expliciet op die eerdere,
  // foute vorm.
  assert.match(
    query,
    /\?rm foaf:depiction \?depictionValue \.\s*OPTIONAL \{ \?depictionValue edm:isShownBy \?imageValue \. \}\s*OPTIONAL \{ \?depictionValue foaf:maker \?makerValue \. \}/,
  );
  assert.match(query, /<https:\/\/linkeddata\.cultureelerfgoed\.nl\/cho-kennis\/id\/rijksmonument\/65314>/);
});

test("parses groenaanleg results, skipping monuments with neither type, categorie noch foto", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, type: { value: "formele tuin" }, categorie: { value: "aanleg" } },
    { rm: { value: "rm:2" } },
  ] } };
  const byMonument = parseGroenaanlegResults(document);
  assert.deepEqual(byMonument.get("rm:1"), { typeAanleg: "formele tuin", categorie: "aanleg" });
  assert.equal(byMonument.has("rm:2"), false);
});

test("parses een eigen groenaanleg-foto, los van de generieke Rijksmonumentfoto", () => {
  const document = { results: { bindings: [
    {
      rm: { value: "rm:1" },
      type: { value: "formele tuin" },
      categorie: { value: "aanleg" },
      image: { value: "https://images.memorix.nl/rce/thumb/fullsize/x.jpg" },
      maker: { value: "Onbekend (beeldbank RCE)" },
      depiction: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/afbeelding/x" },
    },
  ] } };
  const byMonument = parseGroenaanlegResults(document);
  assert.deepEqual(byMonument.get("rm:1"), {
    typeAanleg: "formele tuin",
    categorie: "aanleg",
    image: {
      url: "https://images.memorix.nl/rce/thumb/fullsize/x.jpg",
      license: "Onbekend (beeldbank RCE)",
      sourceUrl: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/afbeelding/x",
    },
  });
});

test("bewaart een groenaanleg-record met alleen een foto, zonder type of categorie", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, image: { value: "https://images.memorix.nl/rce/thumb/fullsize/x.jpg" } },
  ] } };
  const byMonument = parseGroenaanlegResults(document);
  assert.equal(byMonument.get("rm:1")?.image?.url, "https://images.memorix.nl/rce/thumb/fullsize/x.jpg");
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

test("parses each complex member's own geometrie, so the detail map can draw the members' polygonen together", () => {
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

test("discovers archeologische onderzoeksgebieden via CHO-nummer, woonplaats and omschrijving as separate branches", () => {
  // ArcheologischOnderzoeksgebied heeft geen naam/registernummer - het
  // cultuurhistorischObjectnummer is de enige identiteit, net als bij
  // Grondsporen/Vondsten/Archeologische complexen (die alle drie al een
  // "CHO-nummer"-bron als eerste rang hebben). Ook met 112K instanties te
  // groot voor een enkele CONTAINS-query over de hele collectie (zoals
  // Werelderfgoed/Gezicht/Complex dat wel kunnen) - vandaar hetzelfde
  // per-branch-patroon als de Rijksmonument-discovery.
  const queries = buildArcheologischOnderzoekDiscoveryQueries("Nijmegen");
  assert.deepEqual(queries.map((q) => q.bron), ["CHO-nummer (onderzoeksgebied)", "woonplaats (onderzoeksgebied)", "omschrijving (onderzoeksgebied)"]);
  for (const { query } of queries) {
    assert.match(query, /a ceo:ArcheologischOnderzoeksgebied/);
    assert.match(query, /nijmegen/i);
    assert.doesNotMatch(query, /UNION/);
  }
  const choNummer = queries.find((q) => q.bron === "CHO-nummer (onderzoeksgebied)").query;
  assert.match(choNummer, /BIND\(\?choi AS \?match\)/);
  const woonplaats = queries.find((q) => q.bron === "woonplaats (onderzoeksgebied)").query;
  assert.match(woonplaats, /ceo:heeftBasisregistratieRelatie\/ceo:heeftBAGRelatie\/ceo:woonplaatsnaam \?match/);
  const omschrijving = queries.find((q) => q.bron === "omschrijving (onderzoeksgebied)").query;
  assert.match(omschrijving, /ceo:heeftOmschrijving\/ceo:omschrijving \?match/);
});

test("finds an archeologisch onderzoeksgebied by its exact CHO-nummer", () => {
  // Geverifieerd tegen echte data: onderzoeksgebied 10013982 (Heerlen) is
  // alleen op woonplaats/omschrijving te vinden, nooit op zijn eigen
  // CHO-nummer - dit was voor die toevoeging het geval.
  const document = { results: { bindings: [{ choi: { value: "10013982" }, match: { value: "10013982" } }] } };
  const matches = parseArcheologischOnderzoekDiscoveryResults(document, "CHO-nummer (onderzoeksgebied)", "10013982");
  assert.deepEqual(matches, [{ monumentNumber: "10013982", matchSource: "CHO-nummer (onderzoeksgebied)", matchedText: "10013982", matchScore: 10 }]);
});

test("parses archeologisch-onderzoek discovery matches keyed by cultuurhistorischObjectnummer", () => {
  const document = { results: { bindings: [{ choi: { value: "10000040" }, match: { value: "Nijmegen" } }] } };
  const matches = parseArcheologischOnderzoekDiscoveryResults(document, "woonplaats (onderzoeksgebied)", "nijmegen");
  assert.deepEqual(matches, [{ monumentNumber: "10000040", matchSource: "woonplaats (onderzoeksgebied)", matchedText: "Nijmegen", matchScore: 20 }]);
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
  // Losse triples (niet het collapsed pad ?heeftTypeNaam/skos:prefLabel) -
  // zodat de concept-URI van het complextype ook beschikbaar is en niet
  // alleen het label (gemeld door de eigenaar: CHO-nummers naast een
  // onderzoeksgebied's complexen waren geen doorklik naar het rn/2-begrip,
  // 17-08-2026).
  assert.match(query, /\?complex ceo:heeftType\/ceo:heeftTypeNaam \?typeConcept \. \?typeConcept skos:prefLabel \?typeLabelValue \./);
});

test("parses onderzoeksgebied-complexen, keeping the type's concept-URI paired with its label (gemeld door de eigenaar, 17-08-2026)", () => {
  const document = { results: { bindings: [
    { complex: { value: "c:1" }, choi: { value: "2122057" }, typeConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/terp" }, typeLabel: { value: "Terp/wierde" } },
    { complex: { value: "c:2" }, choi: { value: "2122058" } },
  ] } };
  const complexen = parseOnderzoeksgebiedComplexenResults(document);
  assert.deepEqual(complexen, [
    { complexUri: "c:1", choNumber: "2122057", type: { uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/terp", label: "Terp/wierde" } },
    { complexUri: "c:2", choNumber: "2122058", type: undefined },
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

test("looks up a built complex by complexnummer or CHO-nummer", () => {
  const query = buildComplexenQuery("512036");
  assert.match(query, /STR\(\?complexnummer\) = "512036"/);
  assert.match(query, /STR\(\?choi\) = "512036"/);
  assert.match(query, /CONTAINS\(LCASE\(STR\(\?naamValue\)\), "512036"\)/);
});

test("discovers zelfstandige archeologische terreinen via CHO-nummer, Archis-nummer, naam, plaats, omschrijving en waardering", () => {
  const queries = buildArcheologischTerreinDiscoveryQueries("Nijmegen");
  assert.deepEqual(queries.map((query) => query.bron), [
    "CHO-nummer (archeologisch terrein)",
    "Archis-monumentnummer",
    "naam (archeologisch terrein)",
    "woonplaats (archeologisch terrein)",
    "omschrijving (archeologisch terrein)",
    "waardering (archeologisch terrein)",
  ]);
  for (const { query } of queries) {
    assert.match(query, /a ceo:ArcheologischTerrein/);
    assert.match(query, /cultuurhistorischObjectnummer \?choi/);
  }
  assert.match(queries[0].query, /BIND\(\?choi AS \?match\)/);
});

test("finds an archeologisch terrein by its exact CHO-nummer", () => {
  // Archeologisch terrein had, net als Onderzoeksgebied en Vondstlocatie
  // eerder, geen zoekbron voor zijn eigen cultuurhistorischObjectnummer -
  // alleen Archis-monumentnummer (een ander nummer dan het CHO-nummer dat
  // "Hoort bij" op een Archeologisch complex gebruikt).
  const document = { results: { bindings: [{ choi: { value: "10000123" }, match: { value: "10000123" } }] } };
  const matches = parseArcheologischTerreinDiscoveryResults(document, "CHO-nummer (archeologisch terrein)", "10000123");
  assert.deepEqual(matches, [{ monumentNumber: "10000123", matchSource: "CHO-nummer (archeologisch terrein)", matchedText: "10000123", matchScore: 10 }]);
});

test("parses discovery en details van een zelfstandig archeologisch terrein", () => {
  const matches = parseArcheologischTerreinDiscoveryResults(
    { results: { bindings: [{ choi: { value: "9001" }, match: { value: "12345" } }] } },
    "Archis-monumentnummer",
    "12345",
  );
  assert.deepEqual(matches, [{ monumentNumber: "9001", matchSource: "Archis-monumentnummer", matchedText: "12345", matchScore: 20 }]);

  const query = buildArcheologischTerreinDetailsQuery(["9001"]);
  assert.match(query, /VALUES \?choi \{ "9001" \}/);
  assert.match(query, /heeftArcheologischeWaardering/);
  assert.doesNotMatch(query, /heeftGeometrie/);
  assert.match(buildArcheologischTerreinDiscoveryQueries("3958")[1].query, /FILTER\(STR\(\?match\) = "3958"\)/);
  // P1: ligtInObject naar Rijksmonument bestaat in de ontologie (3665
  // exemplaren, live geverifieerd) maar werd nooit opgehaald - een
  // archeologisch terrein dat onderdeel is van een rijksmonument toonde dat
  // nergens.
  assert.match(query, /\?terrein ceo:ligtInObject \?rmValue/);
  assert.match(query, /\?rmValue a ceo:Rijksmonument ; ceo:rijksmonumentnummer \?rmnrValue/);

  const [terrein] = parseStandaloneArcheologischTerreinResults({ results: { bindings: [{
    terrein: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischterrein/9001" },
    choi: { value: "9001" },
    archisNummer: { value: "12345" },
    naam: { value: "Romeins grafveld" },
    omschrijving: { value: "Terrein met resten uit de Romeinse tijd." },
    woonplaats: { value: "Nijmegen" },
    waarderingLabel: { value: "terrein van hoge archeologische waarde" },
    waarderingConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/waarde" },
    rm: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/45708" },
    rmnr: { value: "532442" },
    rmNaam: { value: "Buitenplaats" },
  }] } });
  assert.equal(terrein.monumentNature, "archeologischterrein");
  assert.equal(terrein.monumentNumber, "12345");
  assert.equal(terrein.place, "Nijmegen");
  assert.equal(terrein.archaeologicalValuation, "terrein van hoge archeologische waarde");
  assert.equal(terrein.wkt, undefined);
  assert.equal(terrein.parentObjectNumber, "532442");
  assert.equal(terrein.parentObjectLabel, "Buitenplaats");
});

test("valt terug op 'Rijksmonument {nummer}' als een archeologisch terrein zijn rijksmonument geen naam heeft", () => {
  const [terrein] = parseStandaloneArcheologischTerreinResults({ results: { bindings: [{
    terrein: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischterrein/9002" },
    choi: { value: "9002" },
    rm: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/45709" },
    rmnr: { value: "532443" },
  }] } });
  assert.equal(terrein.parentObjectLabel, "Rijksmonument 532443");
});

test("discovers vondstlocaties via CHO-nummer, beide Archis-nummers, naam, plaats, omschrijving en verwerving", () => {
  const queries = buildVondstlocatieDiscoveryQueries("102482");
  assert.deepEqual(queries.map((query) => query.bron), [
    "CHO-nummer (vondstlocatie)",
    "Archis-vondstmeldingsnummer",
    "Archis-waarnemingsnummer",
    "locatienaam",
    "woonplaats (vondstlocatie)",
    "omschrijving (vondstlocatie)",
    "verwervingswijze",
  ]);
  assert.match(queries[0].query, /BIND\(\?choi AS \?match\)/);
  assert.match(queries[0].query, /FILTER\(STR\(\?match\) = "102482"\)/);
  assert.match(queries[1].query, /FILTER\(STR\(\?match\) = "102482"\)/);
  assert.match(queries[2].query, /archis2Waarnemingsnummer/);
  assert.match(queries[6].query, /heeftVerwerving\/skos:prefLabel/);
});

test("finds a vondstlocatie by its exact CHO-nummer", () => {
  // Voorheen kon een Vondstlocatie alleen via Archis-nummers, naam,
  // woonplaats, omschrijving of verwerving gevonden worden - niet via zijn
  // eigen cultuurhistorischObjectnummer. Dat brak onder meer de bestaande
  // "Vondstlocatie"-doorklik vanaf een Grondspoor/Vondst-detail
  // (onObjectSearch(item.parentObjectNumber)) en de "vondstlocatie"-lijst
  // onder een Onderzoeksgebied, die beide op dat CHO-nummer zoeken.
  const document = { results: { bindings: [{ choi: { value: "10094086" }, match: { value: "10094086" } }] } };
  const matches = parseVondstlocatieDiscoveryResults(document, "CHO-nummer (vondstlocatie)", "10094086");
  assert.deepEqual(matches, [{ monumentNumber: "10094086", matchSource: "CHO-nummer (vondstlocatie)", matchedText: "10094086", matchScore: 10 }]);
});

test("parses een zelfstandige vondstlocatie zonder coördinaten te verzinnen", () => {
  const matches = parseVondstlocatieDiscoveryResults({ results: { bindings: [{ choi: { value: "6109334" }, match: { value: "102482" } }] } }, "Archis-vondstmeldingsnummer", "102482");
  assert.equal(matches[0].matchScore, 20);
  const detailsQuery = buildVondstlocatieDetailsQuery(["6109334"]);
  assert.match(detailsQuery, /VALUES \?choi \{ "6109334" \}/);
  // P1: ligtInObject naar ArcheologischOnderzoeksgebied bestaat in de
  // ontologie (40092 exemplaren, live geverifieerd) maar werd nooit
  // opgehaald.
  assert.match(detailsQuery, /\?locatie ceo:ligtInObject \?gebiedValue/);
  assert.match(detailsQuery, /\?gebiedValue a ceo:ArcheologischOnderzoeksgebied ; ceo:cultuurhistorischObjectnummer \?gebiedChoiValue/);
  const [locatie] = parseVondstlocatieResults({ results: { bindings: [{
    locatie: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6109334" },
    choi: { value: "6109334" }, vondstmelding: { value: "102482" }, waarneming: { value: "102482" },
    locatienaam: { value: "Padstuk-Dres" }, woonplaats: { value: "Opmeer" },
    verwervingConcept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/e06a84fa-62e8-42ff-8f38-0ddfe9485a15" },
    verwervingLabel: { value: "archeologisch: boring" },
    gebied: { value: "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/archeologischonderzoeksgebied/10001066" },
    gebiedChoi: { value: "10001066" },
  }] } });
  assert.equal(locatie.monumentNature, "vondstlocatie");
  assert.equal(locatie.monumentNumber, "102482");
  assert.equal(locatie.archaeologicalAcquisition, "archeologisch: boring");
  assert.equal(locatie.wkt, undefined);
  assert.equal(locatie.parentObjectNumber, "10001066");
  assert.equal(locatie.parentObjectLabel, "Onderzoeksgebied 10001066");
});

test("bouwt een exact-match query op een verwervingswijze-concept-URI, matchend op het CHO-nummer van de vondstlocatie", () => {
  // Anders dan monumentaard/stijl/bouwkundige staat/waardering matcht dit op
  // het CHO-nummer van een Vondstlocatie, niet op een rijksmonumentnummer -
  // searchByConceptMatchQuery (Rijksmonument-detailquery) zou dit ten
  // onrechte als rijksmonumentnummer opzoeken.
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/d303201f-d9c5-44d7-a57c-b65644fed2aa";
  const query = buildVerwervingConceptQuery(uri);
  assert.match(query, /a ceo:Vondstlocatie/);
  assert.match(query, new RegExp(`ceo:heeftVerwerving <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, /LIMIT 100/);
});

test("bouwt een exact-match query op een grondspoor-type-concept-URI, matchend op het eigen CHO-nummer van het grondspoor", () => {
  // Het type-veld op Grondsporen heeft een eigen concept-URI
  // (archaeologicalTypeConceptUri, zie buildGrondsporenDetailsQuery), maar
  // stond nog niet als exacte zoekopdracht doorklikbaar - gemeld door de
  // eigenaar (CHO 10000187, type "grondverkleuring") en live geverifieerd.
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/f4ae6fd1-8ae5-4265-8021-652c637de15c";
  const query = buildGrondspoorTypeConceptQuery(uri);
  assert.match(query, /a ceo:Grondsporen/);
  assert.match(query, /ceo:cultuurhistorischObjectnummer \?rmnr/);
  assert.match(query, new RegExp(`ceo:heeftType/ceo:heeftTypeNaam <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, /LIMIT 100/);
});

test("bouwt een aparte, eigen-begrensde vondstlocatie-inhoudquery per klasse (TD-14)", () => {
  const locatieUri = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/vondstlocatie/6109334";
  for (const klasse of VONDSTLOCATIE_INHOUD_KLASSEN) {
    const query = buildVondstlocatieInhoudQuery(locatieUri, klasse);
    assert.match(query, new RegExp(`VALUES \\?klasse \\{ ceo:${klasse} \\}`));
    assert.match(query, /LIMIT 200/);
  }
  assert.match(buildVondstlocatieInhoudTellingQuery(locatieUri), /COUNT\(DISTINCT \?vondst\)/);
});

test("parses begrensde vondstlocatie-inhoud met concept-URI's en aparte totalen", () => {
  const inhoud = parseVondstlocatieInhoudResults({ results: { bindings: [
    { object: { value: "v:1" }, klasse: { value: `${CEO}Vondsten` }, choi: { value: "1" }, archisVondstnummer: { value: "5888" }, aantal: { value: "2" }, conceptSoort: { value: "type" }, concept: { value: "rn:type" }, conceptLabel: { value: "aardewerk" } },
    { object: { value: "v:1" }, klasse: { value: `${CEO}Vondsten` }, choi: { value: "1" }, aantal: { value: "2" }, conceptSoort: { value: "materiaal" }, concept: { value: "rn:materiaal" }, conceptLabel: { value: "keramiek" } },
    { object: { value: "c:1" }, klasse: { value: `${CEO}ArcheologischComplex` }, choi: { value: "2" }, conceptSoort: { value: "type" }, concept: { value: "rn:complex" }, conceptLabel: { value: "nederzetting" } },
    { object: { value: "g:1" }, klasse: { value: `${CEO}Grondsporen` }, choi: { value: "3" }, aantal: { value: "6" } },
  ] } });
  assert.equal(inhoud.vondsten[0].types[0].uri, "rn:type");
  assert.equal(inhoud.vondsten[0].materialen[0].label, "keramiek");
  assert.equal(inhoud.complexen[0].type.label, "nederzetting");
  assert.equal(inhoud.grondsporen[0].aantal, 6);
  assert.deepEqual(parseVondstlocatieInhoudTelling({ results: { bindings: [{ complexenTotaal: { value: "1" }, vondstenTotaal: { value: "2" }, grondsporenTotaal: { value: "3" } }] } }), { complexenTotaal: 1, vondstenTotaal: 2, grondsporenTotaal: 3 });
});

test("merget vondsten niet weg wanneer complexen/grondsporen een eigen LIMIT-document vullen (TD-14 regressie)", () => {
  // Vóór de fix deelden alle drie de klassen één gezamenlijke LIMIT 500,
  // gesorteerd op ?klasse - "Vondsten" sorteert daarin als laatste, dus een
  // vondstlocatie met genoeg complexen/grondsporen-rijen kon de vondsten
  // volledig verdringen. Elk document hieronder simuleert nu het resultaat
  // van zijn eigen, onafhankelijke per-klasse query: een vol
  // complexen-document en een vol grondsporen-document mogen de vondsten uit
  // het derde, eigen document niet meer kunnen verdringen.
  const volComplexenDocument = {
    results: { bindings: Array.from({ length: 200 }, (_, index) => ({
      object: { value: `c:${index}` }, klasse: { value: `${CEO}ArcheologischComplex` }, choi: { value: String(index) },
    })) },
  };
  const volGrondsporenDocument = {
    results: { bindings: Array.from({ length: 200 }, (_, index) => ({
      object: { value: `g:${index}` }, klasse: { value: `${CEO}Grondsporen` }, choi: { value: String(index) }, aantal: { value: "1" },
    })) },
  };
  const vondstenDocument = {
    results: { bindings: [
      { object: { value: "v:1" }, klasse: { value: `${CEO}Vondsten` }, choi: { value: "1" }, aantal: { value: "2" } },
    ] },
  };
  const inhoud = mergeVondstlocatieInhoud([
    parseVondstlocatieInhoudResults(volComplexenDocument),
    parseVondstlocatieInhoudResults(volGrondsporenDocument),
    parseVondstlocatieInhoudResults(vondstenDocument),
  ]);
  assert.equal(inhoud.complexen.length, 25);
  assert.equal(inhoud.grondsporen.length, 25);
  assert.equal(inhoud.vondsten.length, 1);
  assert.equal(inhoud.vondsten[0].uri, "v:1");
});

test("queries Referentienetwerk 2 als eigen thesaurusbron", () => {
  const query = buildReferentienetwerkTermSuggestQuery("Parochiekerk", 8);
  assert.match(query, /\?concept a skos:Concept ; skos:prefLabel \?label ; skos:inScheme \?scheme/);
  assert.match(query, /VALUES \?scheme/);
  assert.match(query, /a4a7933c-e096-4bcf-a921-4f70a78749fe/);
  assert.match(query, /bf88ef8b-eba4-46a7-9740-d58e983e4990/);
  assert.match(query, /364d5132-a090-4b2c-8cbe-e167f1243f3f/);
  assert.match(query, /3f786c78-e111-4545-be64-f79f495f73f5/);
  assert.match(query, /CONTAINS\(LCASE\(STR\(\?label\)\), "parochiekerk"\)/);
});

test("preserves RN2 concept- en thesaurusidentiteit in termsuggesties", () => {
  const document = { results: { bindings: [{
    concept: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/concept" },
    label: { value: "Parochiekerk" },
    scheme: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/schema" },
    schemeLabel: { value: "Monumenten Registratie Systeem" },
  }] } };
  assert.deepEqual(parseReferentienetwerkTermSuggestResults(document), [{
    uri: "https://data.cultureelerfgoed.nl/term/id/rn/2/concept",
    label: "Parochiekerk",
    sourceUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/schema",
    sourceName: "Monumenten Registratie Systeem",
  }]);
});

test("parses ABR-termsuggesties met een vaste bronnaam", () => {
  const document = { results: { bindings: [{ concept: { value: "abr:1" }, label: { value: "gladwandig aardewerk" } }] } };
  assert.deepEqual(parseAbrTermSuggestResults(document), [
    { uri: "abr:1", label: "gladwandig aardewerk", sourceUri: "https://data.cultureelerfgoed.nl/term/id/abr/thesaurus", sourceName: "Archeologisch Basisregister" },
  ]);
});

test("looks up msp_indicatie by rijksmonumentnummer, alleen de expliciet ware waarde", () => {
  // ceo:msp_indicatie is een "alleen-aanwezig-als-waar"-boolean: afwezigheid
  // van de triple betekent "niet via MSP aangewezen", geen expliciete false.
  const query = buildMspIndicatieQuery(["36046", "45708"]);
  assert.match(query, /GRAPH <https:\/\/linkeddata\.cultureelerfgoed\.nl\/graph\/msp_indicatie>/);
  assert.match(query, /ceo:msp_indicatie true/);
  assert.match(query, /"36046" "45708"/);
});

test("parses msp_indicatie results into a set of aangewezen rijksmonumentnummers", () => {
  const document = { results: { bindings: [{ rmnr: { value: "36046" } }, { rmnr: { value: "45708" } }] } };
  const numbers = parseMspIndicatieResults(document);
  assert.equal(numbers.has("36046"), true);
  assert.equal(numbers.has("45708"), true);
  assert.equal(numbers.has("99999"), false);
});

test("looks up bouwgeschiedenis via heeftGebeurtenis, joining the actorenrol-graph nested inside the same OPTIONAL that binds ?ar", () => {
  // De actorenrol-join moet GENEST staan binnen de OPTIONAL die ?ar bindt -
  // een aparte, niet-geneste OPTIONAL met een soms-ongebonden ?ar veroorzaakt
  // live een kruisproduct-explosie (11+ miljoen tekens op één monument),
  // empirisch aangetoond voordat deze vorm is vastgesteld.
  const query = buildGebeurtenissenQuery(["https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/10047"]);
  assert.match(query, /ceo:heeftGebeurtenis \?g/);
  assert.match(query, /ceo:heeftGebeurtenisNaam \?naamUri \. \?naamUri skos:prefLabel \?naamLabel/);
  assert.match(query, /ceo:heeftDatering\/ceo:heeftBeginDatering\/ceo:datum \?beginDatum/);
  assert.match(query, /ceo:heeftDatering\/ceo:heeftEindDatering\/ceo:datum \?eindDatum/);
  const actorEnRolBlock = query.slice(query.indexOf("ceo:heeftActorEnRol"));
  assert.match(actorEnRolBlock, /GRAPH <https:\/\/linkeddata\.cultureelerfgoed\.nl\/graph\/actorenrol> \{ \?ar ceo:heeftActor \?actorConceptUri \. \}/);
});

test("groups gebeurtenis-rijen per (rm, gebeurtenis), collecting distinct actoren", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, g: { value: "g:1" }, naamUri: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/a88b115d" }, naamLabel: { value: "vervaardiging" }, beginDatum: { value: "1934-01-01" }, eindDatum: { value: "1934-12-31" } },
    { rm: { value: "rm:1" }, g: { value: "g:2" }, naamUri: { value: "https://data.cultureelerfgoed.nl/term/id/rn/2/9bf08937" }, naamLabel: { value: "niet bepaald" }, ar: { value: "ar:56338" }, actorNaam: { value: "Bedaux, Jos ; Noord-Brabant" }, actorRol: { value: "architect / bouwkundige / constructeur" }, actorConceptUri: { value: "https://data.cultureelerfgoed.nl/term/id/rn/f8c2048b" } },
  ] } };
  const byMonument = parseGebeurtenissenResults(document);
  assert.deepEqual(byMonument.get("rm:1"), [
    { naam: "vervaardiging", naamConceptUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/a88b115d", beginDatum: "1934-01-01", eindDatum: "1934-12-31", actoren: [] },
    { naam: "niet bepaald", naamConceptUri: "https://data.cultureelerfgoed.nl/term/id/rn/2/9bf08937", beginDatum: undefined, eindDatum: undefined, actoren: [{ naam: "Bedaux, Jos ; Noord-Brabant", rol: "architect / bouwkundige / constructeur", actorConceptUri: "https://data.cultureelerfgoed.nl/term/id/rn/f8c2048b" }] },
  ]);
});

test("collects multiple distinct rows for the same gebeurtenis into one actoren-lijst, deduped by naam", () => {
  const document = { results: { bindings: [
    { rm: { value: "rm:1" }, g: { value: "g:1" }, naamLabel: { value: "restauratie" }, ar: { value: "ar:1" }, actorNaam: { value: "Kramer, Hendrik ; Stad Leeuwarden" }, actorRol: { value: "architect / bouwkundige / constructeur" } },
    { rm: { value: "rm:1" }, g: { value: "g:1" }, naamLabel: { value: "restauratie" }, ar: { value: "ar:1" }, actorNaam: { value: "Kramer, Hendrik ; Stad Leeuwarden" }, actorRol: { value: "architect / bouwkundige / constructeur" } },
  ] } };
  const [gebeurtenis] = parseGebeurtenissenResults(document).get("rm:1");
  assert.equal(gebeurtenis.actoren.length, 1);
});

test("sorts gebeurtenissen chronologically by beginDatum, missing dates last, and caps at 10 per monument", () => {
  const bindings = Array.from({ length: 12 }, (_, index) => ({
    rm: { value: "rm:1" }, g: { value: `g:${index}` }, naamLabel: { value: `Gebeurtenis ${index}` }, beginDatum: { value: `${1900 + index}-01-01` },
  }));
  bindings.push({ rm: { value: "rm:1" }, g: { value: "g:ongedateerd" }, naamLabel: { value: "Zonder datum" } });
  const events = parseGebeurtenissenResults({ results: { bindings } }).get("rm:1");
  assert.equal(events.length, 10);
  assert.equal(events[0].naam, "Gebeurtenis 0");
  assert.equal(events[9].naam, "Gebeurtenis 9");
});

test("skips rows without a monument, event URI, or gebeurtenisnaam", () => {
  const document = { results: { bindings: [
    { g: { value: "g:1" }, naamLabel: { value: "vervaardiging" } },
    { rm: { value: "rm:1" }, naamLabel: { value: "vervaardiging" } },
    { rm: { value: "rm:1" }, g: { value: "g:1" } },
  ] } };
  assert.equal(parseGebeurtenissenResults(document).size, 0);
  assert.deepEqual(parseGebeurtenissenResults({}), new Map());
});

test("builds an exact-match query on a gebeurtenistype concept-URI", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/a88b115d-ad65-4403-99aa-31210af8bd6d";
  const query = buildGebeurtenisConceptQuery(uri);
  assert.match(query, new RegExp(`ceo:heeftGebeurtenisNaam <${uri.replaceAll(".", "\\.")}>`));
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("builds an exact-match query on an actor concept-URI, joining the actorenrol-graph back to instanties-rce via heeftActorEnRol", () => {
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/f8c2048b-3ddb-4f4b-93d8-12d92b61598b";
  const query = buildActorConceptQuery(uri);
  assert.match(query, new RegExp(`GRAPH <https://linkeddata\\.cultureelerfgoed\\.nl/graph/actorenrol> \\{\\s*\\?ar ceo:heeftActor <${uri.replaceAll(".", "\\.")}> \\.`));
  assert.match(query, /ceo:heeftGebeurtenis\/ceo:heeftActorEnRol \?ar/);
  assert.match(query, new RegExp(`ceo:heeftJuridischeStatus <${RCE_SEMANTICS.activeLegalStatus}>`));
  assert.match(query, /LIMIT 100/);
});

test("builds a query on datumInschrijvingInMonumentenregister, not the unsuitable Gebeurtenis-datering", () => {
  // Live geverifieerd (2026-08-10): heeftBeginDatering's dag/maand staat
  // vrijwel altijd vast op "01-01" (jaarnauwkeurige precisie-conventie,
  // geen echte datum) - datumInschrijvingInMonumentenregister heeft wel
  // een echte, gespreide dag-verdeling. Zie docs/vertical-slices/010-op-deze-dag.md.
  const query = buildOpDezeDagQuery("08-10");
  assert.match(query, /ceo:datumInschrijvingInMonumentenregister \?ins/);
  assert.match(query, /FILTER\(SUBSTR\(STR\(\?ins\), 6, 5\) = "08-10"\)/);
  assert.match(query, /SELECT DISTINCT \?rmnr/);
  assert.match(query, /ceo:heeftMonumentAard <https:\/\/data\.cultureelerfgoed\.nl\/term\/id\/rn\/2\/fc966a68-8863-4970-a83e-110f96006c21>/);
  assert.match(query, /PREFIX foaf: <http:\/\/xmlns\.com\/foaf\/0\.1\/>/);
  assert.match(query, /\?image ceo:rijksmonumentnummer \?rmnr ; foaf:depiction \?depiction \./);
  assert.doesNotMatch(query, /heeftGebeurtenis/);
});

test("parses only the built, pictured candidates returned by the constrained query", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "36046" } },
    { rmnr: { value: "45708" } },
  ] } };
  assert.deepEqual(parseOpDezeDagCandidates(document), [
    { monumentNumber: "36046" },
    { monumentNumber: "45708" },
  ]);
  assert.deepEqual(parseOpDezeDagCandidates({ results: { bindings: [] } }), []);
  assert.deepEqual(parseOpDezeDagCandidates({}), []);
});

test("picks a built candidate with an image deterministically", () => {
  const candidates = [
    { monumentNumber: "20" },
    { monumentNumber: "3" },
    { monumentNumber: "20" },
  ];
  const chosen = pickOpDezeDagCandidate(candidates, 222);
  assert.ok(["3", "20"].includes(chosen));
  assert.equal(pickOpDezeDagCandidate(candidates, 222), chosen);
  assert.equal(pickOpDezeDagCandidate([...candidates].reverse(), 222), chosen);
});

test("builds bounded ground-trace searches with exact CHO numbers", () => {
  const queries = buildGrondsporenDiscoveryQueries("10000135");
  assert.equal(queries.length, 4);
  assert.match(queries[0].query, /a ceo:Grondsporen/);
  assert.match(queries[0].query, /FILTER\(STR\(\?match\) = "10000135"\)/);
  assert.match(queries[1].query, /heeftOmschrijving\/ceo:omschrijving/);
  assert.match(queries[2].query, /ligtInObject\/ceo:heeftBasisregistratieRelatie/);
  assert.match(queries[3].query, /heeftTypeNaam/);
});

test("parses a ground trace as a standalone CHO object without invented geometry", () => {
  const discovery = parseGrondsporenDiscoveryResults({ results: { bindings: [{ choi: { value: "10000135" }, match: { value: "Karrespoor" } }] } }, "omschrijving (grondspoor)", "karrespoor");
  assert.equal(discovery[0].monumentNumber, "10000135");
  const query = buildGrondsporenDetailsQuery(["10000135"]);
  assert.match(query, /a ceo:Grondsporen/);
  assert.match(query, /cultuurhistorischObjectnummer \?vondstlocatieChoiValue/);
  assert.doesNotMatch(query, /heeftGeometrie/);
  const [record] = parseGrondsporenResults({ results: { bindings: [{ grondspoor: { value: "grondspoor:10000135" }, choi: { value: "10000135" }, aantal: { value: "1" }, omschrijving: { value: "Karrespoor" }, typeConcept: { value: "rn:grondspoor" }, typeLabel: { value: "onbekend" }, vondstlocatie: { value: "vondstlocatie:1" }, vondstlocatieChoi: { value: "6175362" }, woonplaats: { value: "Brunssum" } }] } });
  assert.equal(record.name, "Karrespoor");
  assert.equal(record.archaeologicalTraceCount, 1);
  assert.equal(record.place, "Brunssum");
  assert.equal(record.parentObjectNumber, "6175362");
  assert.equal(record.wkt, undefined);
});

test("builds optimized standalone find searches and exact RN2 material searches", () => {
  const queries = buildVondstenDiscoveryQueries("10015422");
  assert.equal(queries.length, 7);
  assert.match(queries[0].query, /cultuurhistorischObjectnummer "10015422"/);
  assert.doesNotMatch(queries[0].query, /FILTER\(STR\(\?match\)/);
  const material = "https://data.cultureelerfgoed.nl/term/id/rn/2/messing";
  assert.match(buildVondstenConceptQuery(material, "materiaal"), new RegExp(`heeftMateriaal/ceo:heeftMateriaalNaam <${material}>`));
  assert.match(buildVondstenConceptQuery(material, "vondsttype"), /heeftType\/ceo:heeftTypeNaam/);
  assert.match(buildVondstenConceptQuery(material, "toestand"), /ceo:heeftToestand/);
});

test("parses standalone finds with type, material, condition and parent location", () => {
  const discovery = parseVondstenDiscoveryResults({ results: { bindings: [{ choi: { value: "10015422" }, match: { value: "messing" } }] } }, "materiaal vondst", "messing");
  assert.equal(discovery[0].monumentNumber, "10015422");
  const query = buildVondstenDetailsQuery(["10015422"]);
  assert.match(query, /heeftMateriaal\/ceo:heeftMateriaalNaam/);
  assert.match(query, /cultuurhistorischObjectnummer \?vondstlocatieChoi/);
  const base = { vondst: { value: "vondst:10015422" }, choi: { value: "10015422" }, aantal: { value: "1" }, omschrijving: { value: "Een messing riemtong" }, vondstlocatie: { value: "locatie:1" }, vondstlocatieChoi: { value: "6175445" }, vondstlocatieNaam: { value: "Collse Watermolen" }, woonplaats: { value: "Eindhoven" } };
  const [record] = parseVondstenResults({ results: { bindings: [
    { ...base, conceptSoort: { value: "type" }, concept: { value: "rn:type" }, conceptLabel: { value: "riemtong - langwerpig" } },
    { ...base, conceptSoort: { value: "materiaal" }, concept: { value: "rn:messing" }, conceptLabel: { value: "messing" } },
    { ...base, conceptSoort: { value: "toestand" }, concept: { value: "rn:onbekend" }, conceptLabel: { value: "onbekend" } },
  ] } });
  assert.equal(record.archaeologicalFindCount, 1);
  assert.equal(record.archaeologicalMaterials[0].label, "messing");
  assert.equal(record.archaeologicalCondition.label, "onbekend");
  assert.equal(record.parentObjectLabel, "Collse Watermolen");
  assert.equal(record.parentObjectNumber, "6175445");
  assert.equal(record.wkt, undefined);
});

test("builds standalone archaeological-complex searches and exact type lookup", () => {
  const queries = buildArcheologischeComplexDiscoveryQueries("10015403");
  assert.equal(queries.length, 4);
  assert.match(queries[0].query, /cultuurhistorischObjectnummer "10015403"/);
  const uri = "https://data.cultureelerfgoed.nl/term/id/rn/2/watermolen";
  assert.match(buildArcheologischeComplexConceptQuery(uri), new RegExp(`heeftType/ceo:heeftTypeNaam <${uri}>`));
  assert.match(buildArcheologischeComplexDetailsQuery(["10015403"]), /VALUES \?parentClass \{ ceo:Vondstlocatie ceo:ArcheologischTerrein ceo:ArcheologischOnderzoeksgebied \}/);
});

test("parses an archaeological complex with all three possible context types", () => {
  const discovery = parseArcheologischeComplexDiscoveryResults({ results: { bindings: [{ choi: { value: "10015403" }, match: { value: "watermolen" } }] } }, "type archeologisch complex", "watermolen");
  assert.equal(discovery[0].monumentNumber, "10015403");
  const base = { complex: { value: "complex:10015403" }, choi: { value: "10015403" }, typeConcept: { value: "rn:watermolen" }, typeLabel: { value: "watermolen" }, omschrijving: { value: "Complex bij een watermolen" } };
  const [record] = parseArcheologischeComplexResults({ results: { bindings: [
    { ...base, parent: { value: "vl:1" }, parentClass: { value: `${CEO}Vondstlocatie` }, parentChoi: { value: "1" }, parentNaam: { value: "Collse Watermolen" }, parentPlaats: { value: "Eindhoven" } },
    { ...base, parent: { value: "terrein:2" }, parentClass: { value: `${CEO}ArcheologischTerrein` }, parentChoi: { value: "2" } },
    { ...base, parent: { value: "onderzoek:3" }, parentClass: { value: `${CEO}ArcheologischOnderzoeksgebied` }, parentChoi: { value: "3" } },
  ] } });
  assert.equal(record.archaeologicalComplexType.label, "watermolen");
  assert.deepEqual(record.archaeologicalContexts.map((item) => item.type), ["Vondstlocatie", "Archeologisch terrein", "Onderzoeksgebied"]);
  assert.equal(record.place, "Eindhoven");
});

test("returns undefined when there are no op-deze-dag candidates at all", () => {
  assert.equal(pickOpDezeDagCandidate([], 100), undefined);
});

test("pagineert archeologische terreinen en onderzoeksgebieden op stabiel CHO-nummer", () => {
  const terreinen = buildArchaeologyBrowseQuery("archeologischterrein", 1);
  assert.match(terreinen, /a ceo:ArcheologischTerrein/);
  assert.match(terreinen, /ORDER BY \?choi/);
  assert.match(terreinen, /LIMIT 25/);
  assert.match(terreinen, /OFFSET 0/);

  const onderzoeken = buildArchaeologyBrowseQuery("onderzoeksgebied", 3);
  assert.match(onderzoeken, /a ceo:ArcheologischOnderzoeksgebied/);
  assert.match(onderzoeken, /OFFSET 50/);
  assert.deepEqual(
    parseArchaeologyBrowseNumbers({ results: { bindings: [{ choi: { value: "10" } }, { choi: { value: "20" } }] } }),
    ["10", "20"],
  );

  assert.match(buildArchaeologyBrowseQuery("vondstlocatie", 2), /a ceo:Vondstlocatie/);
  assert.match(buildArchaeologyBrowseQuery("archeologischcomplex", 2), /a ceo:ArcheologischComplex/);
  assert.match(buildArchaeologyBrowseQuery("vondsten", 2), /a ceo:Vondsten/);
  assert.match(buildArchaeologyBrowseQuery("grondsporen", 2), /a ceo:Grondsporen/);
});

test("pagineert Rijksmonumenten via SPARQL in plaats van genegeerde REST-parameters", () => {
  const query = buildRijksmonumentenBrowseQuery(3);
  assert.match(query, /a ceo:Rijksmonument/);
  assert.match(query, /ORDER BY xsd:integer\(\?rmnr\)/);
  assert.match(query, /LIMIT 25/);
  assert.match(query, /OFFSET 50/);
  assert.deepEqual(
    parseRijksmonumentenBrowseNumbers({ results: { bindings: [{ rmnr: { value: "10001" } }, { rmnr: { value: "10002" } }] } }),
    ["10001", "10002"],
  );
});
