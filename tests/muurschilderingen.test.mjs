import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMuurschilderingDiscoveryQueries,
  buildMuurschilderingGebouwDetailsQuery,
  buildMuurschilderingSchilderingenQuery,
  buildMuurschilderingRijksmonumentGeometrieQuery,
  parseMuurschilderingDiscoveryResults,
  parseMuurschilderingGebouwResults,
  parseMuurschilderingSchilderingenResults,
  parseMuurschilderingRijksmonumentGeometrieResults,
  MUUR_ENDPOINT,
} from "../lib/rce/muurschilderingen.ts";

test("MUUR_ENDPOINT wijst naar de losstaande Muurschilderingen-SPARQL-dienst, niet rce/cho", () => {
  assert.equal(MUUR_ENDPOINT, "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/Muurschilderingen/sparql");
});

test("bouwt naam-, plaats- en makerdiscoveryqueries en, bij een numerieke term, ook een exacte rijksmonumentnummer-lookup", () => {
  const queries = buildMuurschilderingDiscoveryQueries("gouda");
  assert.equal(queries.length, 3);
  assert.equal(queries[0].bron, "naam");
  assert.match(queries[0].query, /gtm:Gebouw/);
  assert.match(queries[0].query, /CONTAINS\(LCASE\(STR\(\?match\)\), LCASE\("gouda"\)\)/);
  assert.equal(queries[1].bron, "plaats");
  assert.match(queries[1].query, /woonplaatsnaam/);
  assert.equal(queries[2].bron, "maker");
  assert.match(queries[2].query, /schema:Person schema:Organization/);
  assert.match(queries[2].query, /dcterms:creator \?maker ; schema:location \?v/);

  const numeriek = buildMuurschilderingDiscoveryQueries("30783");
  assert.equal(numeriek.length, 4);
  assert.equal(numeriek[3].bron, "rijksmonumentnummer");
  assert.match(numeriek[3].query, /ceo:rijksmonumentnummer "30783"/);
});

test("een niet-numerieke term triggert geen exacte rijksmonumentnummer-tak", () => {
  const queries = buildMuurschilderingDiscoveryQueries("goudakerk");
  assert.equal(queries.length, 3);
});

test("aanhalingstekens in de zoekterm blijven binnen de stringliteral (SPARQL-injectie voorkomen)", () => {
  const queries = buildMuurschilderingDiscoveryQueries('") } UNION { ?x a ?y . FILTER(CONTAINS(STR(?y), "');
  assert.match(queries[0].query, /LCASE\("\\"\) \} UNION \{ \?x a \?y \. FILTER\(CONTAINS\(STR\(\?y\), \\""\)\)/);
});

test("parseMuurschilderingDiscoveryResults haalt het item-ID uit de URI als monumentNumber", () => {
  const document = {
    results: {
      bindings: [
        { v: { value: "https://muurschilderingendatabase.nl/api/items/10141" }, match: { value: "Sint-Margaretakerk te Norg" } },
      ],
    },
  };
  const matches = parseMuurschilderingDiscoveryResults(document, "naam", "norg");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].monumentNumber, "10141");
  assert.equal(matches[0].matchSource, "naam");
});

test("naam (rang 1) scoort beter dan maker (rang 3) bij een verder identieke match", () => {
  const document = {
    results: { bindings: [{ v: { value: "https://muurschilderingendatabase.nl/api/items/1" }, match: { value: "test" } }] },
  };
  const naamMatch = parseMuurschilderingDiscoveryResults(document, "naam", "test")[0];
  const makerMatch = parseMuurschilderingDiscoveryResults(document, "maker", "test")[0];
  assert.ok(naamMatch.matchScore < makerMatch.matchScore, "naam-match moet beter scoren dan maker-match");
});

test("een exacte rijksmonumentnummer-match (rang 0) scoort beter dan naam (rang 1)", () => {
  const document = {
    results: { bindings: [{ v: { value: "https://muurschilderingendatabase.nl/api/items/1" }, match: { value: "30783" } }] },
  };
  const rmMatch = parseMuurschilderingDiscoveryResults(document, "rijksmonumentnummer", "30783")[0];
  const naamMatch = parseMuurschilderingDiscoveryResults(document, "naam", "30783")[0];
  assert.ok(rmMatch.matchScore < naamMatch.matchScore);
});

test("een binding zonder URI wordt overgeslagen, geen crash", () => {
  const matches = parseMuurschilderingDiscoveryResults({ results: { bindings: [{ match: { value: "x" } }] } }, "naam", "x");
  assert.deepEqual(matches, []);
});

test("bouwt een gebouw-detailquery met VALUES op de volledige item-URI's, niet de kale ID's", () => {
  const query = buildMuurschilderingGebouwDetailsQuery(["1", "10141"]);
  assert.match(query, /VALUES \?v \{ <https:\/\/muurschilderingendatabase\.nl\/api\/items\/1> <https:\/\/muurschilderingendatabase\.nl\/api\/items\/10141> \}/);
  assert.match(query, /GROUP_CONCAT\(DISTINCT STR\(\?coordValue\); separator="\|"\)/);
});

test("parseMuurschilderingGebouwResults zet een volledige binding om naar een gebouw, met lat/lon geclassificeerd op waardebereik", () => {
  const document = {
    results: {
      bindings: [
        {
          v: { value: "https://muurschilderingendatabase.nl/api/items/10141" },
          naam: { value: "Sint-Margaretakerk te Norg" },
          identifier: { value: "RM30783" },
          rijksmonumentnummer: { value: "30783" },
          plaats: { value: "Norg" },
          huidigeFunctie: { value: "Kerk / Hervormde kerk" },
          coords: { value: "5.306631E1|6.44E0" },
        },
      ],
    },
  };
  const [gebouw] = parseMuurschilderingGebouwResults(document);
  assert.equal(gebouw.id, "10141");
  assert.equal(gebouw.naam, "Sint-Margaretakerk te Norg");
  assert.equal(gebouw.rijksmonumentnummer, "30783");
  assert.equal(gebouw.plaats, "Norg");
  assert.equal(gebouw.lat, 53.06631);
  assert.equal(gebouw.lng, 6.44);
});

test("een gebouw zonder coördinaat wordt tóch geparsed (lat/lng undefined) - de coördinaatfallback zit in de adapter, niet in de parser", () => {
  const document = {
    results: {
      bindings: [
        { v: { value: "https://muurschilderingendatabase.nl/api/items/2" }, naam: { value: "Gebouw zonder coördinaat" }, rijksmonumentnummer: { value: "12345" } },
      ],
    },
  };
  const [gebouw] = parseMuurschilderingGebouwResults(document);
  assert.equal(gebouw.naam, "Gebouw zonder coördinaat");
  assert.equal(gebouw.lat, undefined);
  assert.equal(gebouw.lng, undefined);
});

test("een gebouw zonder naam wordt overgeslagen, geen crash", () => {
  const matches = parseMuurschilderingGebouwResults({ results: { bindings: [{ v: { value: "https://muurschilderingendatabase.nl/api/items/3" } }] } });
  assert.deepEqual(matches, []);
});

test("bouwt een schilderingenquery met VALUES op de gebouw-URI's", () => {
  const query = buildMuurschilderingSchilderingenQuery(["10141"]);
  assert.match(query, /VALUES \?gebouw \{ <https:\/\/muurschilderingendatabase\.nl\/api\/items\/10141> \}/);
  assert.match(query, /schema:location \?gebouw/);
});

test("parseMuurschilderingSchilderingenResults groepeert schilderingen per gebouw, met makers gesplitst en de '0'-sentinel opgeschoond", () => {
  const document = {
    results: {
      bindings: [
        {
          s: { value: "https://muurschilderingendatabase.nl/api/items/12258" },
          gebouw: { value: "https://muurschilderingendatabase.nl/api/items/10141" },
          titel: { value: "De elementen water en vuur" },
          begin: { value: "1935" },
          eind: { value: "1935" },
          locatieomschrijving: { value: "koor" },
          makers: { value: "Charles Eyck|Richard Roland Holst" },
        },
        {
          s: { value: "https://muurschilderingendatabase.nl/api/items/99" },
          gebouw: { value: "https://muurschilderingendatabase.nl/api/items/10141" },
          titel: { value: "Zonder datering" },
          begin: { value: "0" },
        },
      ],
    },
  };
  const byGebouw = parseMuurschilderingSchilderingenResults(document);
  const schilderingen = byGebouw.get("10141");
  assert.equal(schilderingen.length, 2);
  assert.equal(schilderingen[0].titel, "De elementen water en vuur");
  assert.equal(schilderingen[0].dateringVan, "1935");
  assert.deepEqual(schilderingen[0].makers, ["Charles Eyck", "Richard Roland Holst"]);
  assert.equal(schilderingen[1].dateringVan, undefined, "'0' is een sentinel voor 'geen datering bekend', geen jaar 0");
});

test("een schildering zonder maker heeft een lege makers-lijst, geen crash", () => {
  const document = {
    results: {
      bindings: [
        { s: { value: "https://muurschilderingendatabase.nl/api/items/1" }, gebouw: { value: "https://muurschilderingendatabase.nl/api/items/2" }, titel: { value: "Zonder maker" } },
      ],
    },
  };
  const byGebouw = parseMuurschilderingSchilderingenResults(document);
  assert.deepEqual(byGebouw.get("2")[0].makers, []);
});

test("een binding zonder gebouw wordt overgeslagen, geen crash", () => {
  const byGebouw = parseMuurschilderingSchilderingenResults({ results: { bindings: [{ s: { value: "https://muurschilderingendatabase.nl/api/items/1" }, titel: { value: "x" } }] } });
  assert.equal(byGebouw.size, 0);
});

test("bouwt een rijksmonument-geometriequery met VALUES op de kale nummers (geen URI's, rijksmonumentnummer is een plain literal)", () => {
  const query = buildMuurschilderingRijksmonumentGeometrieQuery(["30783", "507030"]);
  assert.match(query, /VALUES \?rm \{ "30783" "507030" \}/);
  assert.match(query, /ceo:heeftGeometrie \?geom/);
});

test("parseMuurschilderingRijksmonumentGeometrieResults zet WKT om naar lat\\/lng via de gedeelde wktToLatLng", () => {
  const document = {
    results: { bindings: [{ rm: { value: "30783" }, wkt: { value: "POINT(6.44 53.06631)" } }] },
  };
  const result = parseMuurschilderingRijksmonumentGeometrieResults(document);
  assert.equal(result.get("30783").lat, 53.06631);
  assert.equal(result.get("30783").lng, 6.44);
});

test("bij een dubbel rijksmonumentnummer in de resultaten telt alleen de eerste rij", () => {
  const document = {
    results: {
      bindings: [
        { rm: { value: "1" }, wkt: { value: "POINT(5 52)" } },
        { rm: { value: "1" }, wkt: { value: "POINT(6 53)" } },
      ],
    },
  };
  const result = parseMuurschilderingRijksmonumentGeometrieResults(document);
  assert.equal(result.size, 1);
  assert.equal(result.get("1").lng, 5);
});
