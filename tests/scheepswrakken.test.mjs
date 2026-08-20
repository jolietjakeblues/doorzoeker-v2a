import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScheepswrakDiscoveryQueries,
  buildScheepswrakDetailsQuery,
  parseScheepswrakDiscoveryResults,
  parseScheepswrakResults,
  MASS_ENDPOINT,
} from "../lib/rce/scheepswrakken.ts";

test("MASS_ENDPOINT wijst naar de losstaande mass-SPARQL-dienst, niet rce/cho", () => {
  assert.equal(MASS_ENDPOINT, "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/mass/sparql");
});

test("bouwt een naam-discoveryquery en, bij een numerieke term, ook een exacte MASS-ID-lookup", () => {
  const queries = buildScheepswrakDiscoveryQueries("hendrika");
  assert.equal(queries.length, 1);
  assert.equal(queries[0].bron, "naam");
  assert.match(queries[0].query, /sdo:Vehicle/);
  assert.match(queries[0].query, /CONTAINS\(LCASE\(STR\(\?match\)\), LCASE\("hendrika"\)\)/);

  const numeriek = buildScheepswrakDiscoveryQueries("1");
  assert.equal(numeriek.length, 2);
  assert.equal(numeriek[1].bron, "MASS-nummer");
  assert.match(numeriek[1].query, /mass\.cultureelerfgoed\.nl\/id\/", "1"/);
});

test("een niet-numerieke term triggert geen exacte MASS-ID-tak", () => {
  const queries = buildScheepswrakDiscoveryQueries("hendrika1850");
  assert.equal(queries.length, 1);
});

test("aanhalingstekens in de zoekterm blijven binnen de stringliteral (SPARQL-injectie voorkomen)", () => {
  const queries = buildScheepswrakDiscoveryQueries('") } UNION { ?x a ?y . FILTER(CONTAINS(STR(?y), "');
  // Het payload-fragment mag in de query-tekst voorkomen zolang het
  // geëscaped binnen de stringliteral van LCASE(...) blijft - dat is de
  // hele bedoeling van escapeSparqlString(). De ontsnappende aanhalings-
  // tekens zelf moeten wél geëscaped zijn (\").
  assert.match(queries[0].query, /LCASE\("\\"\) \} UNION \{ \?x a \?y \. FILTER\(CONTAINS\(STR\(\?y\), \\""\)\)/);
});

test("parseScheepswrakDiscoveryResults haalt het MASS-ID uit de URI als monumentNumber", () => {
  const document = {
    results: {
      bindings: [
        { v: { value: "https://mass.cultureelerfgoed.nl/id/1" }, match: { value: "Hendrika" } },
        { v: { value: "https://mass.cultureelerfgoed.nl/id/1" }, match: { value: "Hendrika (+1850)" } },
      ],
    },
  };
  const matches = parseScheepswrakDiscoveryResults(document, "naam", "hendrika");
  assert.equal(matches.length, 2);
  assert.equal(matches[0].monumentNumber, "1");
  // Lager scoreDiscoveryMatch-getal = betere match; de exacte treffer
  // "Hendrika" moet dus een lager (beter) getal krijgen dan de langere
  // "Hendrika (+1850)"-variant.
  assert.ok(matches[0].matchScore <= matches[1].matchScore, "exacte match scoort niet hoger dan de langere variant");
});

test("een binding zonder URI wordt overgeslagen, geen crash", () => {
  const matches = parseScheepswrakDiscoveryResults({ results: { bindings: [{ match: { value: "x" } }] } }, "naam", "x");
  assert.deepEqual(matches, []);
});

test("bouwt een detailquery met VALUES op de volledige MASS-URI's, niet de kale ID's", () => {
  const query = buildScheepswrakDetailsQuery(["1", "1000"]);
  assert.match(query, /VALUES \?v \{ <https:\/\/mass\.cultureelerfgoed\.nl\/id\/1> <https:\/\/mass\.cultureelerfgoed\.nl\/id\/1000> \}/);
  assert.match(query, /FILTER\(!CONTAINS\(STR\(\?naamValue\), "\(\+"\)\)/);
});

test("parseScheepswrakResults zet een volledige binding om naar een Scheepswrak", () => {
  const document = {
    results: {
      bindings: [
        {
          v: { value: "https://mass.cultureelerfgoed.nl/id/1" },
          naam: { value: "Hendrika" },
          scheepstype: { value: "Fregat" },
          omschrijving: { value: "<h1>Historie</h1><p>Gezonken in 1850.</p>" },
          lat: { value: "51.717" },
          lng: { value: "3.646" },
          ontdekt: { value: "2004" },
          licentieNaam: { value: "Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)" },
          licentieUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
          bronUrl: { value: "https://mass.cultureelerfgoed.nl/hendrika" },
        },
      ],
    },
  };
  const [wrak] = parseScheepswrakResults(document);
  assert.equal(wrak.id, "1");
  assert.equal(wrak.naam, "Hendrika");
  assert.equal(wrak.scheepstype, "Fregat");
  assert.equal(wrak.lat, 51.717);
  assert.equal(wrak.lng, 3.646);
  assert.equal(wrak.ontdekt, "2004");
  assert.equal(wrak.licentieUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
});

test("een wrak zonder coördinaten wordt overgeslagen, geen kaartitem zonder locatie verzinnen", () => {
  const document = {
    results: {
      bindings: [{ v: { value: "https://mass.cultureelerfgoed.nl/id/2" }, naam: { value: "Zonder locatie" } }],
    },
  };
  assert.deepEqual(parseScheepswrakResults(document), []);
});
