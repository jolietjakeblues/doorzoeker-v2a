import assert from "node:assert/strict";
import test from "node:test";
import { buildRceDiscoveryQueries, buildRceFacetsQuery, buildRceNumberQuery, buildRceParcelQuery, mergeDiscoveryMatches, parseDiscoveryBranchResults, parseParcelResults, parseRceMonuments, parseSparqlResults, RCE_SEMANTICS } from "../lib/rce.ts";

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
  const document = { results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis(K)" }, omschrijving: { value: "Pand met 17e eeuwse lijstgevel." }, monumentaard: { value: "onroerend gebouwd" }, volledigAdres: { value: "Brigittenstraat 18" }, postcode: { value: "3512KM" }, woonplaats: { value: "Utrecht" }, wkt: { value: "Point (5.1267842049703 52.088895166661)" }, inschrijving: { value: "1967-06-20" } }] } };
  assert.deepEqual(parseSparqlResults(document), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "", houseNumber: "", postalCode: "3512KM", sourceUrl: "rm:38342", name: undefined, functionName: "Woonhuis(K)", originalFunctionNames: [], currentFunctionNames: [], typeNames: [], legalStatus: "rijksmonument", description: "Pand met 17e eeuwse lijstgevel.", monumentNature: "onroerend gebouwd", fullAddress: "Brigittenstraat 18", place: "Utrecht", lng: 5.1267842049703, lat: 52.088895166661, wkt: "Point (5.1267842049703 52.088895166661)" }]);
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
