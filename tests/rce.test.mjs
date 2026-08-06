import assert from "node:assert/strict";
import test from "node:test";
import { buildRceDiscoveryQuery, buildRceNumberQuery, buildRceParcelQuery, parseDiscoveryResults, parseParcelResults, parseRceMonuments, parseSparqlResults } from "../lib/rce.ts";

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
  const document = { results: { bindings: [{ cho: { value: "rm:38342" }, choi: { value: "38342" }, rmnr: { value: "36046" }, functie: { value: "Woonhuis(K)" }, omschrijving: { value: "Pand met 17e eeuwse lijstgevel." }, monumentaard: { value: "onroerend gebouwd" }, volledigAdres: { value: "Brigittenstraat 18" }, postcode: { value: "3512KM" }, woonplaats: { value: "Utrecht" }, wkt: { value: "POINT(5.1267842049703 52.088895166661)" }, inschrijving: { value: "1967-06-20" } }] } };
  assert.deepEqual(parseSparqlResults(document), [{ choNumber: "38342", monumentNumber: "36046", registrationDate: "1967-06-20", street: "", houseNumber: "", postalCode: "3512KM", sourceUrl: "rm:38342", name: undefined, functionName: "Woonhuis(K)", description: "Pand met 17e eeuwse lijstgevel.", monumentNature: "onroerend gebouwd", fullAddress: "Brigittenstraat 18", place: "Utrecht", lng: 5.1267842049703, lat: 52.088895166661, wkt: "POINT(5.1267842049703 52.088895166661)" }]);
});

test("queries and parses BRK parcels separately", () => {
  const query = buildRceParcelQuery("36046");
  assert.match(query, /ceo:heeftBRKRelatie/);
  assert.doesNotMatch(query, /ceo:heeftBAGRelatie/);
  const document = { results: { bindings: [{ gemeente: { value: "Utrecht" }, gemeentecode: { value: "996" }, sectie: { value: "B" }, perceel: { value: "358" }, provinciecode: { value: "UT" } }] } };
  assert.deepEqual(parseParcelResults(document), [{ municipality: "Utrecht", municipalityCode: "996", section: "B", parcelNumber: "358", provinceCode: "UT" }]);
});

test("only queries formally established descriptions", () => {
  const query = buildRceNumberQuery("36046");
  assert.match(query, /ceo:heeftOmschrijving \?omschrijvingNode/);
  assert.match(query, /ceo:omschrijving \?omschrijvingValue/);
  assert.match(query, /ceo:formeelStandpunt true/);
});

test("discovers functions, types and only formal descriptions", () => {
  const query = buildRceDiscoveryQuery('woonhuis "K"');
  assert.match(query, /ceo:heeftOorspronkelijkeFunctie/);
  assert.match(query, /graph\/instanties-rce/);
  assert.match(query, /ceo:heeftJuridischeStatus/);
  assert.match(query, /ceo:heeftOorspronkelijkeFunctie \?functieNode/);
  assert.match(query, /\?functieNode ceo:formeelStandpunt true/);
  assert.match(query, /ceo:heeftHuidigeFunctie/);
  assert.match(query, /ceo:heeftType/);
  assert.match(query, /ceo:heeftMonumentAard/);
  assert.match(query, /ceo:formeelStandpunt true/);
  assert.match(query, /woonhuis \\"K\\"/);
});

test("deduplicates matches and prefers a function over a description", () => {
  const document = { results: { bindings: [
    { rmnr: { value: "36046" }, match: { value: "Pand met lijstgevel" }, bron: { value: "formele omschrijving" } },
    { rmnr: { value: "36046" }, match: { value: "Woonhuis(K)" }, bron: { value: "oorspronkelijke functie" } },
  ] } };
  assert.deepEqual(parseDiscoveryResults(document), [{ monumentNumber: "36046", matchSource: "oorspronkelijke functie", matchedText: "Woonhuis(K)" }]);
});
